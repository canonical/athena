# Juju Athena Machine Charm

## Purpose

The Juju Athena Machine Charm is the released deployment artifact for installing
and operating an Athena Workshop Runner on an Ubuntu VM managed by Juju.

The charm provisions the host runtime. It is not a harness and it is not the
portable Workshop SDK. The portable execution environment is defined in
[workshop-runner.md](./workshop-runner.md).

## Responsibilities

The charm owns:

1. Installing and configuring the Ubuntu Workshop and LXD prerequisites.
2. Installing and supervising the Athena Workshop Runner on the Ubuntu host.
3. Configuring runner identity, encrypted credentials, proxy settings, and
   required network access.
4. Preparing storage, Workshop networking, and resource limits.
5. Reporting host and Workshop readiness to Juju and Athena.
6. Upgrading and rolling back the runner agent and its configuration.

The charm does not own task routing, harness decisions, task state, or
repository policy. Those remain Athena responsibilities.

## Deployment contract

The charm must deploy to a real Ubuntu VM machine. Deployment inside an
unprivileged Juju/LXD container is not a supported execution target because
Workshop requires host-level access to LXD and its storage/network facilities.

The host must provide:

1. A supported Ubuntu base and architecture.
2. LXD 6.8 or newer.
3. A usable LXD storage pool and Workshop bridge network.
4. Outbound access to Ubuntu image and Workshop SDK sources, directly or via a
   configured proxy.
5. Enough CPU, memory, and disk for the configured concurrent executions.

## Lifecycle

1. Juju installs the charm on an allocated VM.
2. The charm installs LXD and Workshop, then initializes or validates their
   configuration.
3. The charm installs and supervises the Athena Workshop Runner.
4. The host agent registers with Athena and reports `ready` only after
   Workshop can launch and execute a health-check Workshop.
5. The charm keeps the host agent and Workshop services running and reports
   degraded status when either becomes unavailable.
6. On removal, the charm drains active executions before destroying runner
   state according to the configured retention policy.

## Configuration

Configuration must support at least:

- Athena endpoint and runner identity.
- Encrypted runner credential reference.
- HTTP, HTTPS, and no-proxy settings for LXD and `workshopd`.
- LXD storage and Workshop resource limits.
- Maximum concurrent Workshop executions.
- Workshop base image and SDK channels.
- Workspace retention and cleanup policy.

Secrets must be delivered through Juju secrets or an equivalent encrypted
mechanism. They must not be stored in charm configuration, logs, or Workshop
definitions.

## Release acceptance criteria

1. A clean Juju VM can install the charm and reach `ready`.
2. The charm can launch a Workshop containing the `athena-runner` SDK.
3. The runner agent can start, observe, cancel, and clean up an execution.
4. Proxy-enabled and direct-egress deployments are supported.
5. Charm upgrade, rollback, unit restart, and VM reboot preserve safe runner
   behavior and do not duplicate active executions.
6. Credentials and host filesystem access are isolated and redacted.

## Related specifications

- [workshop-runner.md](./workshop-runner.md)
- [runner-harness.md](./runner-harness.md)
- [runner-connection.plan.md](../implementation-plans/runner-connection.plan.md)

External references:

- [Ubuntu Workshop](https://ubuntu.com/workshop)
- [Workshop SDK definition](https://ubuntu.com/workshop/docs/reference/definition-files/sdk-definition/)
