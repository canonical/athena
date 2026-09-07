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

To install a development branch, use the branch in both the script URL and the
installer argument, for example:

```bash
curl -fsSL https://raw.githubusercontent.com/canonical/athena/feat/athena-workshop-runner/scripts/athena-runner.install | sudo sh -s -- --branch feat/athena-workshop-runner
```

Branch selection can also be changed after installation with
`athenaconfigure`.

The installer updates Ubuntu, installs LXD, Canonical Workshop, and Node.js 24
from the `24/stable` Snap channel, then starts the runner's systemd service.

## Configure a runner workforce

Create an `Athena Workshop` runner in Athena, create a workforce token on its
detail page, and write the connection settings inside the VM:

```bash
sudo athenaconfigure --url http://192.168.1.57
```

The command prompts for the branch, defaulting to the currently saved branch
or `main` when none is saved, then prompts for the runner name, optional
hostname, and token. When using an IP URL with Traefik, set the hostname to a
configured route such as `athena.localhost`. `athenaconfigure` adds the
hostname and URL address to `/etc/hosts` and stores the URL using that
hostname, so the runner connects to the IP while `fetch()` sends the expected
Host value. Use `--branch BRANCH`, `--name NAME`, `--host HOST`, or
`--token TOKEN` to provide values non-interactively. Press Enter at any prompt
to keep the saved value; an initial configuration still requires URL, name,
and token.

`athenaconfigure` restarts the service after changing configuration. On every
restart, the service fetches the configured branch, checks it out, installs
dependencies, and rebuilds the runner before starting it.

Multiple runner units may use the same token. Each unit registers its own
instance identity and appears separately under the Athena runner workforce.

## Connect to local Athena

The runner must reach Athena through the host address reachable from the VM,
not `localhost`. For example, if the host is reachable at `192.168.1.57` and
Traefik is exposed on port `80`, provide that address and the Traefik hostname
to `athenaconfigure`:

```bash
sudo athenaconfigure --url http://192.168.1.57 --host athena.localhost
```

The command writes `192.168.1.57 athena.localhost` to `/etc/hosts` and stores
`http://athena.localhost` as the runner URL.
