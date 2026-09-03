#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Athena ExpressJS charm entrypoint."""

import copy
import logging
import typing

import ops
import paas_charm.expressjs
from paas_charm.app import App

logger = logging.getLogger(__name__)

VERSION = "1.1.4"


class AthenaApp(App):
    """Athena workload with web and background worker services."""

    def _app_layer(self) -> ops.pebble.LayerDict:
        """Add a worker service using the generated web service environment."""
        layer = super()._app_layer()
        raw_services = layer.get("services")
        if raw_services is None:
            raise RuntimeError("Generated Pebble layer has no services")
        services = typing.cast(dict[str, dict[str, typing.Any]], raw_services)
        worker = copy.deepcopy(services[self._workload_config.service_name])
        environment = typing.cast(dict[str, str], worker.setdefault("environment", {}))
        environment["APP_ATHENA_INSTANCE_ID"] = self._workload_config.unit_name
        worker.update(
            {
                "command": "npm run start:worker",
                "override": "replace",
                "startup": "enabled",
            }
        )
        services["athena-worker"] = worker
        return layer


class AthenaCharm(paas_charm.expressjs.Charm):
    """Athena ExpressJS charm service."""

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the charm.

        Args:
            args: passthrough to the paas_charm ExpressJS charm base.
        """
        super().__init__(*args)
        self.framework.observe(self.on.start, self._on_start)

    def _on_start(self, event: ops.StartEvent) -> None:
        self.unit.set_workload_version(VERSION)

    def _create_app(self) -> App:
        """Build the Athena web and worker application."""
        return AthenaApp(
            container=self._container,
            charm_state=self._create_charm_state(),
            workload_config=self._workload_config,
            database_migration=self._database_migration,
            framework_config_prefix="",
        )


if __name__ == "__main__":
    ops.main(AthenaCharm)
