#!/usr/bin/env python3
# Copyright 2025 Ubuntu
# See LICENSE file for licensing details.

"""ExpressJS Charm entrypoint."""

import logging
import typing

import ops

import paas_charm.expressjs

from traefik_config import ConfigureTraefik

logger = logging.getLogger(__name__)

VERSION = "1.17.1"

class ZeusCharm(paas_charm.expressjs.Charm):
    """ExpressJS Charm service."""

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the instance.

        Args:
            args: passthrough to CharmBase.
        """
        super().__init__(*args)

        self.framework.observe(self.on.start, self._on_start)

        self.traefik_config = ConfigureTraefik(self)

    def _on_start(self, event: ops.StartEvent):
        """Set the workload version when the charm starts.  

        Args:  
            event: The start event.  
        """  
        self.unit.set_workload_version(VERSION)

if __name__ == "__main__":
    ops.main(ZeusCharm)
