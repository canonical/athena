# Athena agent guide

This file is a brief index of repository documentation for coding agents.

## Start here

Read these documents before making changes:

- [README](./README.md): project scope, runtime overview, and developer workflows.
- [Coding standards](./docs/coding-standards.md): canonical source layout and file move conventions.
- [Database standards](./docs/database-standards.md): canonical database naming, identifier, and migration rules.
- [Testing standards](./docs/testing-standards.md): canonical test strategy, E2E scope, and coverage expectations.
- [PR publishing and updating standards](./docs/pr-publishing-updating-standards.md): canonical pull request validation and update requirements.

## Jira workflow

- All Athena work is tracked under [PRTL-3872](https://warthogs.atlassian.net/browse/PRTL-3872), the Athena AI Orchestrator objective.
- Jira tickets are the source of specifications for Athena implementation work.
- While developing Athena, agents must use Jira MCP to retrieve ticket scope, acceptance criteria, dependencies, and status.

## Authoring direction

- Keep normative rules in the most local canonical document and reference them here.
- Avoid duplicating standards text between docs.
