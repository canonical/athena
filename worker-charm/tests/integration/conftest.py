# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Shared fixtures for Athena worker charm integration tests."""

import os
import pathlib

import pytest


@pytest.fixture(scope="session")
def charm() -> pathlib.Path:
    """Return the packed worker charm path."""
    configured = os.environ.get("CHARM_PATH")
    if configured:
        path = pathlib.Path(configured).resolve()
    else:
        charms = list(pathlib.Path().glob("*.charm"))
        assert len(charms) == 1, f"Expected one packed charm, found {charms}"
        path = charms[0].resolve()
    assert path.is_file(), f"{path} is not a file"
    return path
