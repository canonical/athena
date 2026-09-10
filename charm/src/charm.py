#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Athena web charm entrypoint."""

import logging
import typing
import urllib.parse

import ops
import paas_charm.expressjs
from paas_charm.app import App

logger = logging.getLogger(__name__)

VERSION = "1.1.4"


class AthenaApp(App):
    """Athena web workload with post-migration worker grant synchronization."""

    def __init__(
        self,
        *args: typing.Any,
        sync_worker_access: typing.Callable[[], None],
        **kwargs: typing.Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._sync_worker_access = sync_worker_access

    def _run_migrations(self) -> None:
        """Run Athena-owned migrations before refreshing worker grants."""
        super()._run_migrations()
        self._sync_worker_access()


class AthenaCharm(paas_charm.expressjs.Charm):
    """Athena ExpressJS charm service."""

    _stored = ops.StoredState()

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the charm.

        Args:
            args: passthrough to the paas_charm ExpressJS charm base.
        """
        super().__init__(*args)
        self._stored.set_default(worker_roles={})
        self.framework.observe(self.on.start, self._on_start)
        self.framework.observe(self.on.workers_relation_changed, self._on_workers_changed)
        self.framework.observe(self.on.workers_relation_broken, self._on_workers_broken)

    def _on_start(self, event: ops.StartEvent) -> None:
        self.unit.set_workload_version(VERSION)

    def _database_environment(self) -> dict[str, str] | None:
        """Return libpq environment variables for Athena's database relation."""
        database = self._database_requirers.get("postgresql")
        relation_data = database.to_relation_data() if database else None
        if not relation_data:
            return None

        parsed = urllib.parse.urlparse(relation_data.uris.split(",")[0])
        if not parsed.hostname or not parsed.username or parsed.password is None:
            return None

        environment = {
            "PGHOST": parsed.hostname,
            "PGPORT": str(parsed.port or 5432),
            "PGUSER": urllib.parse.unquote(parsed.username),
            "PGPASSWORD": urllib.parse.unquote(parsed.password),
            "PGDATABASE": parsed.path.lstrip("/"),
        }
        environment.update(dict(urllib.parse.parse_qsl(parsed.query)))
        return environment

    def _apply_worker_access(self, role: str, grant: bool) -> bool:
        """Apply or remove database access for one relation-managed worker role."""
        if not self.unit.is_leader() or not self._container.can_connect():
            return False

        environment = self._database_environment()
        if not environment:
            return False

        script = "grant-worker.sql" if grant else "revoke-worker.sql"
        try:
            process = self._container.exec(
                [
                    "psql",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-v",
                    f"WORKER_ROLE_NAME={role}",
                    "-f",
                    f"/app/migrations/pg/{script}",
                ],
                environment=environment,
                working_dir="/app",
                user="_daemon_",
                group="_daemon_",
            )
            process.wait_output()
        except ops.pebble.ExecError:
            logger.exception("Unable to %s database access for worker role", script.split("-")[0])
            return False
        return True

    def _on_workers_changed(self, event: ops.RelationChangedEvent) -> None:
        """Grant the related worker role access to Athena-owned database objects."""
        if not self.unit.is_leader() or event.app is None:
            return
        role = event.relation.data[event.app].get("database-role")
        if not role:
            event.defer()
            return
        if not self._apply_worker_access(role, grant=True):
            event.defer()
            return

        roles = dict(self._stored.worker_roles)
        previous_role = roles.get(str(event.relation.id))
        if (
            previous_role
            and previous_role != role
            and not self._apply_worker_access(previous_role, grant=False)
        ):
            event.defer()
            return
        roles[str(event.relation.id)] = role
        self._stored.worker_roles = roles
        event.relation.data[self.app]["database-access-role"] = role

    def _sync_worker_access(self) -> None:
        """Refresh grants after Athena creates or migrates database objects."""
        if not self.unit.is_leader():
            return
        roles = dict(self._stored.worker_roles)
        for relation in self.model.relations.get("workers", []):
            if relation.app is None:
                continue
            role = relation.data[relation.app].get("database-role")
            if role and self._apply_worker_access(role, grant=True):
                roles[str(relation.id)] = role
                relation.data[self.app]["database-access-role"] = role
        self._stored.worker_roles = roles

    def _revoke_relation_worker(self, relation_id: int) -> bool:
        """Revoke grants recorded for a removed worker relation."""
        roles = dict(self._stored.worker_roles)
        role = roles.pop(str(relation_id), None)
        if role and not self._apply_worker_access(role, grant=False):
            return False
        self._stored.worker_roles = roles
        return True

    def _on_workers_broken(self, event: ops.RelationBrokenEvent) -> None:
        if not self._revoke_relation_worker(event.relation.id):
            event.defer()

    def _create_app(self) -> App:
        """Build the Athena web application."""
        return AthenaApp(
            container=self._container,
            charm_state=self._create_charm_state(),
            workload_config=self._workload_config,
            database_migration=self._database_migration,
            framework_config_prefix="",
            sync_worker_access=self._sync_worker_access,
        )


if __name__ == "__main__":
    ops.main(AthenaCharm)
