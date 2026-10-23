#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Athena background worker charm entrypoint."""

import logging
import os
import typing
import urllib.parse

import ops
from charms.data_platform_libs.v0.data_interfaces import (  # pyright: ignore[reportMissingImports]
    DatabaseRequires,
)

logger = logging.getLogger(__name__)

VERSION = "1.2.0"


class AthenaWorkerCharm(ops.CharmBase):
    """Operate the independently scalable Athena background worker."""

    def __init__(self, framework: ops.Framework) -> None:
        """Initialize worker lifecycle event handlers."""
        super().__init__(framework)
        self._container = self.unit.get_container("app")
        self._database = DatabaseRequires(
            self,
            relation_name="postgresql",
            database_name=str(self.config["database-name"]),
            extra_user_roles="admin",
        )
        framework.observe(self.on.app_pebble_ready, self._reconcile)
        framework.observe(self.on.config_changed, self._on_config_changed)
        framework.observe(self.on.secret_changed, self._on_database_changed)
        framework.observe(self._database.on.database_created, self._on_database_changed)
        framework.observe(self._database.on.endpoints_changed, self._on_database_changed)
        framework.observe(self.on.postgresql_relation_broken, self._on_database_broken)
        framework.observe(self.on.update_status, self._on_update_status)
        framework.observe(self.on.start, self._on_start)

    def _on_start(self, _: ops.StartEvent) -> None:
        """Publish the workload version."""
        self.unit.set_workload_version(VERSION)

    def _on_update_status(self, _: ops.UpdateStatusEvent) -> None:
        """Report a stopped or failed worker service."""
        if not self._container.can_connect():
            self.unit.status = ops.WaitingStatus("Waiting for workload container")
            return

        services = self._container.get_services("athena-worker")
        service = services.get("athena-worker")
        if service and service.is_running():
            self.unit.status = ops.ActiveStatus()
        else:
            self.unit.status = ops.BlockedStatus("Worker service is not running")

    def _secret_value(self, config_name: str, content_key: str) -> str | None:
        """Read one value from a configured Juju secret."""
        secret_reference = self.config.get(config_name)
        if not secret_reference:
            return None

        try:
            content = self.model.get_secret(id=str(secret_reference)).get_content(refresh=True)
        except (ops.ModelError, ops.SecretNotFoundError):
            logger.exception("Unable to read worker %s secret", config_name)
            return None

        value = content.get(content_key)
        return value if isinstance(value, str) and value else None

    def _database_uri(self) -> str | None:
        """Build the worker-owned PostgreSQL connection URI."""
        relation_data = list(
            self._database.fetch_relation_data(
                fields=["uris", "endpoints", "username", "password", "database"]
            ).values()
        )
        data = relation_data[0] if relation_data else {}
        uris = data.get("uris")
        if uris:
            return uris.split(",")[0]

        endpoint = data.get("endpoints")
        username = data.get("username")
        password = data.get("password")
        if not endpoint or not username or not password:
            return None

        database = data.get("database") or str(self.config["database-name"])
        return "postgresql://{}:{}@{}/{}".format(
            urllib.parse.quote(username, safe=""),
            urllib.parse.quote(password, safe=""),
            endpoint.split(",")[0],
            urllib.parse.quote(database, safe=""),
        )

    def _on_config_changed(self, event: ops.ConfigChangedEvent) -> None:
        """Refresh the requested database name and reconcile the worker."""
        database_name = str(self.config["database-name"])
        self._database.database = database_name
        relation = self.model.get_relation("postgresql")
        if self.unit.is_leader() and relation:
            self._database.update_relation_data(relation.id, {"database": database_name})
        self._on_database_changed(event)

    def _on_database_changed(self, event: typing.Any) -> None:
        """Reconcile the worker service when database credentials change."""
        self._reconcile(event)

    def _on_database_broken(self, _: ops.RelationBrokenEvent) -> None:
        """Stop processing when the PostgreSQL relation is removed."""
        if not self._container.can_connect():
            self.unit.status = ops.WaitingStatus("Waiting for workload container")
            return
        self._block("PostgreSQL relation is required")

    def _credential_key(self) -> str | None:
        """Read the shared credential encryption key from its Juju secret."""
        return self._secret_value("credential", "encryption-key")

    def _disable_http_service(self) -> None:
        """Disable the HTTP service inherited from the shared application image."""
        layer = ops.pebble.Layer(
            {
                "summary": "Disable Athena HTTP service",
                "services": {
                    "expressjs": {
                        "override": "replace",
                        "summary": "Disabled Athena HTTP service",
                        "command": "npm start",
                        "startup": "disabled",
                        "working-dir": "/app",
                    }
                },
            }
        )
        self._container.add_layer("athena-worker", layer, combine=True)

        services = self._container.get_services("expressjs")
        service = services.get("expressjs")
        if service and service.is_running():
            self._container.stop("expressjs")

    def _block(self, message: str) -> None:
        """Stop all application work when a required dependency is unavailable."""
        self._disable_http_service()
        services = self._container.get_services("athena-worker")
        service = services.get("athena-worker")
        if service and service.is_running():
            self._container.stop("athena-worker")
        self.unit.status = ops.BlockedStatus(message)

    def _reconcile(self, _: typing.Any) -> None:
        """Render and start the worker when all runtime dependencies are present."""
        if not self._container.can_connect():
            self.unit.status = ops.WaitingStatus("Waiting for workload container")
            return

        self._disable_http_service()

        database_uri = self._database_uri()
        if not database_uri:
            self._block("PostgreSQL relation is required")
            return

        credential_key = self._credential_key()
        if not credential_key:
            self._block("Credential encryption secret is required")
            return

        environment = {
            "APP_ATHENA_POSTGRESQL_DB_CONNECT_STRING": database_uri,
            "APP_ATHENA_CREDENTIAL_ENCRYPTION_KEY": credential_key,
            "APP_ATHENA_INSTANCE_ID": self.unit.name,
            "APP_ATHENA_PG_POOL_MAX": str(self.config["pg-pool-max"]),
            "APP_ATHENA_PG_POOL_IDLE_TIMEOUT_MS": str(self.config["pg-pool-idle-timeout-ms"]),
            "APP_ATHENA_PG_CONNECTION_TIMEOUT_MS": str(self.config["pg-connection-timeout-ms"]),
            "APP_ATHENA_BACKGROUND_JOB_WORKER_CONCURRENCY": str(
                self.config["background-job-worker-concurrency"]
            ),
            "APP_ATHENA_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS": str(
                self.config["background-job-shutdown-timeout-ms"]
            ),
        }
        for name in ("http_proxy", "https_proxy", "no_proxy"):
            value = os.environ.get(f"JUJU_CHARM_{name.upper()}")
            if value:
                environment[name] = value
                environment[name.upper()] = value

        layer = ops.pebble.Layer(
            {
                "summary": "Athena background worker",
                "services": {
                    "expressjs": {
                        "override": "replace",
                        "summary": "Disabled Athena HTTP service",
                        "command": "npm start",
                        "startup": "disabled",
                        "working-dir": "/app",
                    },
                    "athena-worker": {
                        "override": "replace",
                        "summary": "Athena background worker",
                        "command": "node --enable-source-maps dist/worker.js",
                        "startup": "enabled",
                        "working-dir": "/app",
                        "user": "_daemon_",
                        "group": "_daemon_",
                        "environment": environment,
                    },
                },
            }
        )
        self._container.add_layer("athena-worker", layer, combine=True)
        self._container.replan()
        if self._container.get_service("athena-worker").is_running():
            self.unit.status = ops.ActiveStatus()
        else:
            self.unit.status = ops.BlockedStatus("Worker service failed to start")


if __name__ == "__main__":
    ops.main(AthenaWorkerCharm)
