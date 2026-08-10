# Athena agent guide

This file is a brief index of repository documentation for coding agents.

## Start here

Read these documents before making changes:

- [README](./README.md): project scope, runtime overview, and developer workflows.
- [Workgraph concept](./docs/workgraph.md): canonical concept for external project hierarchy ingestion, refinement rules, and Workgraph/runtime boundaries.
- [Coding standards](./docs/coding-standards.md): canonical source layout and file move conventions.
- [Documentation standards](./docs/documentation-standards.md): canonical markdown cross-reference and documentation authoring rules.
- [Design standards](./docs/design-standards.md): minimal UI/UX defaults for layout, accessibility, states, and icon usage.
- [Database standards](./docs/database-standards.md): canonical database naming, identifier, and migration rules.
- [Testing standards](./docs/testing-standards.md): canonical test strategy, E2E scope, and coverage expectations.
- [Task iteration](./docs/task-iteration.md): working notes for task iteration behavior while implementation is in progress.
- [PR publishing and updating standards](./docs/pr-publishing-updating-standards.md): canonical pull request validation and update requirements.

## Local specs workflow

- Athena specifications and references are maintained locally in [docs/specs](./docs/specs).
- Specification, reference, and description artifacts are tracked in repository docs, not external trackers.
- Before implementation, agents must retrieve scope, acceptance criteria, dependencies, and status from local specs.
- Keep local specs current whenever behavior, ownership, approvals, or sequencing changes.
- Use [docs/specs/definitions](./docs/specs/definitions) for normative rules, including persona lifecycle and constraints in [docs/specs/definitions/persona.md](./docs/specs/definitions/persona.md).
- Use [docs/specs/personas](./docs/specs/personas) as default/reference persona behavior definitions.
- Jira is an optional external task source for Athena loops and is only used when loop ingestion from Jira is explicitly configured.

## Authoring direction

- Keep normative rules in the most local canonical document and reference them here.
- Avoid duplicating standards text between docs.
