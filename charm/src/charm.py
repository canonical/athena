#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Athena web charm entrypoint."""

import typing

import ops
import paas_charm.expressjs

VERSION = "1.2.0"


class AthenaCharm(paas_charm.expressjs.Charm):
    """Athena ExpressJS charm service."""

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the charm.

        Args:
            args: passthrough to the paas_charm ExpressJS charm base.
        """
        super().__init__(*args)
        postgresql = self._database_requirers.get("postgresql")
        if postgresql:
            postgresql.extra_user_roles = "admin"
        self.framework.observe(self.on.start, self._on_start)

    def _on_start(self, event: ops.StartEvent) -> None:
        self.unit.set_workload_version(VERSION)


if __name__ == "__main__":
    ops.main(AthenaCharm)
