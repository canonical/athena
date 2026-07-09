#!/usr/bin/env python3
# Copyright 2025 Canonical Ltd.
# See LICENSE file for licensing details.

"""Athena ExpressJS charm entrypoint."""

import logging
import typing

import ops
import paas_charm.expressjs

logger = logging.getLogger(__name__)


class AthenaCharm(paas_charm.expressjs.Charm):
    """Athena ExpressJS charm service."""

    def __init__(self, *args: typing.Any) -> None:
        """Initialize the charm.

        Args:
            args: passthrough to the paas_charm ExpressJS charm base.
        """
        super().__init__(*args)


if __name__ == "__main__":
    ops.main(AthenaCharm)
