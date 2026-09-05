# Athena Workshop Runner Quick Start

This guide installs the Athena Workshop Runner on an Ubuntu Multipass VM.

## Prerequisites

- Multipass
- An Ubuntu VM with network access
- Athena running locally with Traefik exposed on port `80`

The default Multipass NAT network is sufficient. Bridged networking is not
required when the runner only calls Athena.

## Install the runner

Run this command inside the Ubuntu VM:

```bash
curl -fsSL https://raw.githubusercontent.com/canonical/athena/main/scripts/athena-runner.install | sudo sh
```

To install another branch, replace the placeholder in this command:

```bash
curl -fsSL https://raw.githubusercontent.com/canonical/athena/main/scripts/athena-runner.install | sudo sh -s -- '<branch-name>'
```

When no branch is provided, the installer uses `main`.

The installer updates Ubuntu, installs LXD, Canonical Workshop, and Node.js 24
from the `24/stable` Snap channel, builds the runner, and starts its systemd
service.

## Connect to local Athena

The runner must call Athena through the host address reachable from the VM,
not `localhost`. For example, if the host is reachable at `192.168.1.57` and
Traefik is exposed on port `80`, configure the runner to use:

```text
http://192.168.1.57
```

Ensure the request uses a hostname that matches an Athena Traefik route when
host-based routing is required.
