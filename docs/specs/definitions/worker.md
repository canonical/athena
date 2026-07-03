# Runner and Harness

## Purpose

This definition establishes the normative meaning of **runner** and **harness** as distinct concepts in Athena's agentic execution model.

## Core concepts

### Runner

A **runner** is the execution environment or platform that hosts and operates a harness. Runners are infrastructure-level resources — they provide compute, networking, and lifecycle management for the harness processes that run within them.

Runners are not agents. They do not interpret tasks or produce code. They provide the environment in which a harness operates.

Runners fall into two categories:

**Proprietary runners** are managed by a third-party vendor and expose a closed, vendor-specific interface. Athena must implement a dedicated adapter for each proprietary runner. The vendor controls availability, API surface, and upgrade cadence.

- **GitHub Copilot Cloud** — a cloud-managed runner operated by GitHub; exposes a proprietary API. Athena integrates via a GitHub-specific adapter. **MVP — only executable runner.**

**Open runners** expose a standard interface defined and implemented in the Athena codebase. Any harness that conforms to the Athena open runner contract can be deployed on an open runner without a bespoke adapter per harness.

- **Juju VM** — an Athena-owned virtual machine provisioned via a Juju machine charm. The charm is implemented in the Athena codebase and defines the open runner standard that eligible harnesses must satisfy. **Post-MVP (MVP+1) — Athena-owned implementation target.**
- **Local Ubuntu binary** — a user-managed Ubuntu machine running the Athena open runner binary. Suitable for local testing or a disposable virtual machine with internet access. Running on a personal local machine is discouraged for production workloads. **Post-MVP.**

### Harness

A **harness** is an AI coding agent tool that runs within a runner and performs agentic coding work on behalf of Athena personas. Harnesses interpret task context, call tools, write code, and produce structured outputs.

Harnesses are not infrastructure. They do not provision compute or manage connectivity. They execute work within the environment provided by a runner.

Harnesses supported per runner:

**GitHub Copilot Cloud (proprietary, MVP):**
- **GitHub Copilot** — the built-in harness bundled with the GitHub Copilot Cloud runner. **MVP.**

**Juju VM / Local Ubuntu binary (open runner, post-MVP):**
- **OpenCode** — an open-source AI coding harness. **Post-MVP candidate.**
- **Claude Code** — Anthropic's AI coding harness. **Post-MVP candidate.**
- Additional harnesses that conform to the Athena open runner harness contract. **Post-MVP.**

## Harness definition and runner binding

A **harness definition** is an owner-scoped connection profile that Athena uses to invoke a harness on a runner. It stores:

- The **runner type** (`runnerType`): which execution environment the harness runs on.
- Credentials and connectivity settings required to reach the runner.
- Lifecycle status and runtime tuning fields.

For proprietary runners that bundle a single harness (e.g., GitHub Copilot Cloud), the harness type is implicit and determined by the runner. For open runners that can host multiple harness types (e.g., Juju VM), the harness type is tracked as an additional field on the definition.

## Runner and harness catalog

### Runners

| Runner | Type | Identifier | Status |
|---|---|---|---|
| GitHub Copilot Cloud | Proprietary | `github-copilot-cloud` | MVP — only executable runner |
| Juju VM | Open (Athena-owned) | `juju-vm` | Post-MVP (MVP+1) — Athena-owned implementation target |
| Local Ubuntu binary | Open (user-managed) | `local-ubuntu` | Post-MVP — discouraged for production use |

### Harnesses

| Harness | Compatible runners | Status |
|---|---|---|
| GitHub Copilot | `github-copilot-cloud` (bundled) | MVP |
| OpenCode | `juju-vm`, `local-ubuntu` | Post-MVP candidate |
| Claude Code | `juju-vm`, `local-ubuntu` | Post-MVP candidate |
| Additional open harnesses | `juju-vm`, `local-ubuntu` | Post-MVP — subject to open runner contract |

## MVP constraint

In MVP, the only executable runner is **GitHub Copilot Cloud** (`github-copilot-cloud`). Harness definitions targeting any other runner type are rejected at creation time and skipped at execution time with an auditable reason.

## Cross references

- Harness definition CRUD and loop assignment: [llm-harness.md](./llm-harness.md)
- Loop ownership and membership model: [theloop.md](./theloop.md)
- Tool execution semantics: [tool-usage.md](./tool-usage.md)
