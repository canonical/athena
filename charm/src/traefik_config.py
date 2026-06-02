#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Traefik configuration and relation logic."""
import socket
import ops

from charms.traefik_k8s.v0.traefik_route import TraefikRouteRequirer

DEFAULT_APPLICATION_PORT = 8080
DEFAULT_APPLICATION_ROOT = "/"


class ConfigureTraefik:
    def __init__(self, charm: ops.CharmBase):
        self.charm = charm
        self._fqdn = socket.getfqdn()
        # app-port is defined by the expressjs-framework extension
        self._port = int(charm.model.config.get("app-port") or DEFAULT_APPLICATION_PORT)
        self.traefik_route = TraefikRouteRequirer(
            charm,
            charm.model.get_relation("traefik-route"),
            "traefik-route",
            raw=False,
        )
        self._update_traefik_route_relation()

    @property
    def _traefik_route_config(self) -> dict:
        """Build a raw ingress configuration for Traefik."""
        model = self.charm.model.name
        app = self.charm.unit.app.name
        # Normalize root/prefix to a single leading slash and no trailing slash
        raw_prefix = self.charm.model.config.get("root") or DEFAULT_APPLICATION_ROOT
        if raw_prefix == DEFAULT_APPLICATION_ROOT:
            prefix = DEFAULT_APPLICATION_ROOT
        else:
            prefix = f"/{raw_prefix.strip('/')}"

        lb_servers = [{"url": f"http://{self._fqdn}:{self._port}"}]
        peer_relations = self.charm.model.get_relation("secret-storage")

        if peer_relations:
            for unit in peer_relations.units:
                unit_name = unit.name.replace("/", "-")
                unit_fqdn = (
                    "http://"
                    f"{unit_name}."
                    f"{app}-endpoints."
                    f"{model}.svc.cluster.local"
                )
                lb_servers.append({"url": f"{unit_fqdn}:{self._port}"})

        traefik_config = {
            "http": {
                "routers": {
                    f"juju-{model}-{app}-router": {
                        "rule": f"PathPrefix(`{prefix}`)",
                        "service": f"juju-{model}-{app}-service",
                        "entryPoints": ["web"],
                    },
                },
                "services": {
                    f"juju-{model}-{app}-service": {
                        "loadBalancer": {"servers": lb_servers},
                    },
                },
            },
        }

        return traefik_config

    def _update_traefik_route_relation(self) -> None:
        """Make sure the traefik route is up-to-date."""
        if not self.charm.unit.is_leader():
            return

        if self.traefik_route.is_ready():
            self.traefik_route.submit_to_traefik(
                self._traefik_route_config,
            )
