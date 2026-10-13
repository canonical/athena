# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Integration tests for the independently deployed Athena worker charm."""

import json
import os
import pathlib

import jubilant
import pytest

APP_NAME = "athena-worker"
WEB_APP_NAME = "athena"
POSTGRESQL_APP_NAME = "postgresql-k8s"


@pytest.fixture(scope="session")
def app_image() -> str:
    """Return the Athena OCI image supplied to the worker charm."""
    image = os.environ.get("ATHENA_APP_IMAGE")
    if not image:
        pytest.fail("Set ATHENA_APP_IMAGE to the packed Athena OCI image reference.")
    assert image
    return image


@pytest.mark.juju_setup
def test_worker_blocks_without_required_relations(
    charm: pathlib.Path, app_image: str, juju: jubilant.Juju
) -> None:
    """Require PostgreSQL and credential dependencies before processing."""
    juju.deploy(charm, app=APP_NAME, resources={"app-image": app_image})
    juju.wait(jubilant.all_blocked, timeout=10 * 60)


def test_database_and_credential_start_worker(
    web_charm: pathlib.Path, app_image: str, juju: jubilant.Juju
) -> None:
    """Exercise direct PostgreSQL credentials and the worker service."""
    juju.deploy(
        web_charm,
        app=WEB_APP_NAME,
        resources={"app-image": app_image},
    )
    juju.deploy(POSTGRESQL_APP_NAME, channel="14/stable", trust=True)

    oidc_uri = juju.cli(
        "add-secret", "athena-worker-test-oidc", "client-secret=super-secret-value"
    ).strip()
    credential_uri = juju.cli(
        "add-secret",
        "athena-worker-test-credential",
        "encryption-key=integration-encryption-key",
    ).strip()
    session_uri = juju.cli(
        "add-secret", "athena-worker-test-session", "key=integration-session-secret"
    ).strip()

    for secret_name in (
        "athena-worker-test-oidc",
        "athena-worker-test-credential",
        "athena-worker-test-session",
    ):
        juju.cli("grant-secret", secret_name, WEB_APP_NAME)
    juju.cli("grant-secret", "athena-worker-test-credential", APP_NAME)

    juju.config(
        WEB_APP_NAME,
        {"oidc": oidc_uri, "credential": credential_uri, "secret": session_uri},
    )
    juju.config(APP_NAME, {"credential": credential_uri})

    juju.integrate(WEB_APP_NAME, POSTGRESQL_APP_NAME)
    juju.cli(
        "wait-for",
        "application",
        WEB_APP_NAME,
        '--query=status=="active"',
        "--timeout=15m",
    )
    juju.integrate(APP_NAME, POSTGRESQL_APP_NAME)

    juju.wait(jubilant.all_active, timeout=15 * 60)

    services = juju.cli(
        "exec",
        "--unit",
        f"{APP_NAME}/0",
        "--container",
        "app",
        "--",
        "pebble",
        "services",
    )
    assert "athena-worker" in services
    assert "active" in services
    assert "expressjs" in services
    assert "inactive" in services

    status = json.loads(juju.cli("status", APP_NAME, "--format=json"))
    worker_unit = status["applications"][APP_NAME]["units"][f"{APP_NAME}/0"]
    assert worker_unit["workload-status"]["current"] == "active"
    assert worker_unit["workload-version"] == "1.2.0"
