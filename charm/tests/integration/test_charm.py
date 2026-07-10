# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Integration tests for the Athena charm.

These mirror the manual flow: deploy the charm, integrate PostgreSQL, provide the
required secrets, and assert the application reaches active status.
"""

import logging
import os
import pathlib

import jubilant
import pytest
import yaml

logger = logging.getLogger(__name__)

METADATA = yaml.safe_load(pathlib.Path("charmcraft.yaml").read_text())
APP_NAME = METADATA["name"]


@pytest.fixture(scope="session")
def app_image() -> str:
    """OCI reference for the 'app-image' resource, taken from ATHENA_APP_IMAGE.

    The expressjs-framework extension supplies the 'app-image' resource, and the
    image is built and pushed locally, so there is no upstream-source to read from
    charmcraft.yaml. Point ATHENA_APP_IMAGE at the pushed image, for example
    'localhost:32000/athena:0.0.1-local'.
    """
    image = os.environ.get("ATHENA_APP_IMAGE")
    if not image:
        pytest.fail(
            "Set ATHENA_APP_IMAGE to the app-image OCI reference before running "
            "integration tests (e.g. localhost:32000/athena:<tag>)."
        )
    return image


@pytest.mark.juju_setup
def test_deploy_without_database_is_blocked(
    charm: pathlib.Path, app_image: str, juju: jubilant.Juju
):
    """Deploy Athena on its own and assert it blocks on the required database relation."""
    juju.deploy(charm, app=APP_NAME, resources={"app-image": app_image})
    juju.wait(jubilant.all_blocked, timeout=10 * 60)


def test_database_integration_and_secrets_make_active(juju: jubilant.Juju):
    """Integrate PostgreSQL and provide the required secrets, then assert active status."""
    juju.deploy("postgresql-k8s", channel="14/stable", trust=True)

    oidc_uri = juju.cli(
        "add-secret", "athena-oidc", "client-secret=super-secret-value"
    ).strip()
    credential_uri = juju.cli(
        "add-secret", "athena-credential", "encryption-key=integration-encryption-key"
    ).strip()
    session_uri = juju.cli(
        "add-secret", "athena-session", "key=integration-session-secret"
    ).strip()

    for secret_name in ("athena-oidc", "athena-credential", "athena-session"):
        juju.cli("grant-secret", secret_name, APP_NAME)

    juju.config(
        APP_NAME,
        {"oidc": oidc_uri, "credential": credential_uri, "secret": session_uri},
    )

    juju.integrate(APP_NAME, "postgresql-k8s")

    juju.wait(jubilant.all_active, timeout=15 * 60)
