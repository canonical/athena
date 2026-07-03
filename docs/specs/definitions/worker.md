# Worker

## Purpose

This definition establishes the normative meaning of **worker**, **runner**, and **harness** as distinct concepts in Athena's agentic execution model.

## Core concepts

### Runner

A **runner** is the execution environment or platform that hosts and operates a harness. Runners are infrastructure-level resources — they provide compute, networking, and lifecycle management for the harness processes that run within them.

Examples:

- **GitHub Copilot Cloud** — a cloud-managed runner operated by GitHub; hosts the GitHub Copilot coding agent.
- **Juju VM** — an Athena-owned virtual machine provisioned via Juju machine charm; can host multiple harness types.

Runners are not agents. They do not interpret tasks or produce code. They provide the environment in which a harness operates.

### Harness

A **harness** is an AI coding agent tool that runs within a runner and performs agentic coding work on behalf of Athena personas. Harnesses interpret task context, call tools, write code, and produce structured outputs.

Examples:

- **GitHub Copilot** — the built-in harness bundled with the GitHub Copilot Cloud runner.
- **OpenCode** — an open-source harness deployable on a Juju VM runner.
- **Claude Code** — an AI coding harness deployable on a Juju VM runner.
- **OpenAI Codex** — a cloud-based coding harness.
- **Devin** — a fully managed harness+runner combination provided as a single vendor service.

Harnesses are not infrastructure. They do not provision compute or manage connectivity. They execute work within the environment provided by a runner.

### Worker

A **worker** is the effective agentic execution unit — the combination of a runner and the harness operating within it. When Athena dispatches agentic work, it targets a worker. The worker is backed by a specific harness running on a specific runner.

Athena does not reason about runners or harnesses in isolation at dispatch time. Athena reasons about workers — the named, configured, and credentialed execution profiles that it can invoke.

## Harness definition and runner binding

A **harness definition** is an owner-scoped connection profile that Athena uses to invoke a worker. It stores:

- The **runner type** (`runnerType`): which execution environment the harness runs on.
- Credentials and connectivity settings required to reach the runner.
- Lifecycle status and runtime tuning fields.

For runners that host a single harness type (e.g., GitHub Copilot Cloud), the harness type is implicit and determined by the runner. For runners that can host multiple harness types (e.g., Juju VM), the harness type is tracked as an additional field on the definition.

## Runner and harness catalog

### Runners

| Runner | Identifier | Status |
|---|---|---|
| GitHub Copilot Cloud | `github-copilot-cloud` | MVP — only executable runner |
| Juju VM | `juju-vm` | MVP+1 — Athena-owned implementation target |

### Harnesses

| Harness | Compatible runners | Status |
|---|---|---|
| GitHub Copilot | `github-copilot-cloud` | MVP — bundled with GitHub Copilot Cloud runner |
| OpenCode | `juju-vm` | Post-MVP candidate |
| Claude Code | `juju-vm` | Post-MVP candidate |
| OpenAI Codex | `juju-vm` and cloud | Post-MVP candidate |
| Devin | Managed (vendor) | Post-MVP candidate |

## MVP constraint

In MVP, the only executable runner is **GitHub Copilot Cloud** (`github-copilot-cloud`). Harness definitions targeting any other runner type are rejected at creation time and skipped at execution time with an auditable reason.

## Cross references

- Harness definition CRUD and loop assignment: [llm-harness.md](./llm-harness.md)
- Loop ownership and membership model: [theloop.md](./theloop.md)
- Tool execution semantics: [tool-usage.md](./tool-usage.md)
