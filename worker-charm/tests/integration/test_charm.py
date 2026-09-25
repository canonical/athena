# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Integration tests for the independently deployed Athena worker charm."""

import os
import pathlib

import jubilant
import pytest

APP_NAME = "athena-worker"


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
    """Require PostgreSQL, Athena, and credential dependencies before processing."""
    juju.deploy(charm, app=APP_NAME, resources={"app-image": app_image})
    juju.wait(jubilant.all_blocked, timeout=10 * 60)
