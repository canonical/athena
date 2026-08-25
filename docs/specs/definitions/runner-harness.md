# Runner and Harness

## Purpose

This definition establishes the normative meaning of **runner** and **harness** as distinct concepts in Athena's agentic execution model.

The detailed open runner contract for Ubuntu Workshop-backed execution is
defined in [workshop-runner.md](./workshop-runner.md).

## Core concepts

### Runner

A **runner** is the execution environment or platform that hosts and operates a harness. Runners are infrastructure-level resources — they provide compute, networking, and lifecycle management for the harness processes that run within them.

Runners are not agents. They do not interpret tasks or produce code. They provide the environment in which a harness operates.

Runners fall into two categories:

**Proprietary runners** are managed by a third-party vendor and expose a closed, vendor-specific interface. Athena must implement a dedicated adapter for each proprietary runner. The vendor controls availability, API surface, and upgrade cadence.

- **GitHub Copilot Cloud** — a cloud-managed runner operated by GitHub; exposes a proprietary API. Athena integrates via a GitHub-specific adapter. **Current executable runner.**

**Open runners** expose a standard interface defined and implemented in the Athena codebase. Any harness that conforms to the Athena open runner contract can be deployed on an open runner without a bespoke adapter per harness. The Ubuntu Workshop-backed contract is defined in [workshop-runner.md](./workshop-runner.md).

- **Athena Workshop Runner** — a portable runner that can run on any supported Ubuntu machine with Workshop installed. It uses the `athena-runner` Workshop SDK inside each isolated Workshop. See [workshop-runner.md](./workshop-runner.md). **Portable runner target.**

### Harness

A **harness** is an AI coding agent tool that runs within a runner and performs agentic coding work on behalf of Athena personas. Harnesses interpret task context, call tools, write code, and produce structured outputs.

Harnesses are not infrastructure. They do not provision compute or manage connectivity. They execute work within the environment provided by a runner.

Harnesses supported per runner:

**GitHub Copilot Cloud (proprietary):**
- **GitHub Copilot** — the built-in harness bundled with the GitHub Copilot Cloud runner. **Available.**

**Athena Workshop Runner (open runner):**

The runner is the same [workshop-runner.md](./workshop-runner.md) contract on
any supported Ubuntu machine. It installs the `athena-runner` SDK into each
Workshop and provides the isolated execution environment in which each harness
runs.

- **OpenCode** — an open-source AI coding harness. **Candidate.**
- **Claude Code** — Anthropic's AI coding harness. **Candidate.**
- Additional harnesses that conform to the [workshop-runner.md](./workshop-runner.md)
  harness-facing contract. **Candidate.**

## Harness definition and runner binding

A **harness definition** is an owner-scoped connection profile that Athena uses to invoke a harness on a runner. It stores:

- The **runner type** (`runnerType`): which execution environment the harness runs on.
- Credentials and connectivity settings required to reach the runner.
- Lifecycle status and runtime tuning fields.

For proprietary runners that bundle a single harness (e.g., GitHub Copilot Cloud), the harness type is implicit and determined by the runner. For the Ubuntu Workshop runner, which can host multiple harness types, the harness type is tracked as an additional field on the definition.

## Runner and harness catalog

### Runners

| Runner | Type | Identifier | Status |
|---|---|---|---|
| GitHub Copilot Cloud | Proprietary | `github-copilot-cloud` | Current executable runner |
| Athena Workshop Runner | Open | `athena-workshop` | Portable runner target |

### Harnesses

| Harness | Compatible runners | Status |
|---|---|---|
| GitHub Copilot | `github-copilot-cloud` (bundled) | Available |
| OpenCode | `athena-workshop` | Candidate |
| Claude Code | `athena-workshop` | Candidate |
| Additional open harnesses | `athena-workshop` | Candidate — subject to open runner contract |

## Current execution constraint

GitHub Copilot Cloud (`github-copilot-cloud`) is currently the only executable runner type. Other runner types become selectable as they are implemented and validated against the open runner contract.

## Juju VM Charm deployment

[juju-athena-machine-charm.md](./juju-athena-machine-charm.md) defines the releasable
Juju VM host deployment for the `athena-workshop` runner. The charm is a
deployment artifact, not a separate runner catalog entry or runner type.

## Cross references

- Harness definition CRUD and loop assignment: [llm-harness.md](./llm-harness.md)
- Loop ownership and membership model: [theloop.md](./theloop.md)
- Tool execution semantics: [tool-usage.md](./tool-usage.md)
