#!/usr/bin/env python3
# Copyright 2025 Ubuntu
# See LICENSE file for licensing details.

"""ExpressJS Charm entrypoint."""

import logging
import typing

import ops

import paas_charm.expressjs
from charms.traefik_k8s.v2.ingress import IngressPerAppReadyEvent, IngressPerAppRequirer, IngressPerAppRevokedEvent

logger = logging.getLogger(__name__)

VERSION = "0.0.1"
ATHENA_SERVICE_PORT = 8080

class AthenaCharm(paas_charm.expressjs.Charm):
    """ExpressJS Charm service."""

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the instance.

        Args:
            args: passthrough to CharmBase.
        """
        super().__init__(*args)

        self.framework.observe(self.on.start, self._on_start)
        self.ingress = IngressPerAppRequirer(
            self,
            port=ATHENA_SERVICE_PORT,
            healthcheck_params={"path": "/_status/check"},
        )
        self.framework.observe(self.ingress.on.ready, self._on_ingress_ready)
        self.framework.observe(self.ingress.on.revoked, self._on_ingress_revoked)

    def _on_start(self, event: ops.StartEvent):
        """Set the workload version when the charm starts.  

        Args:  
            event: The start event.  
        """  
        self.unit.set_workload_version(VERSION)

    def _on_ingress_ready(self, event: IngressPerAppReadyEvent) -> None:
        """Log the ingress URL published by ingress-configurator."""
        logger.info("Athena ingress is ready at %s", event.url)

    def _on_ingress_revoked(self, event: IngressPerAppRevokedEvent) -> None:
        """Log ingress removal for Athena."""
        logger.info("Athena ingress is no longer available")

if __name__ == "__main__":
    ops.main(AthenaCharm)
