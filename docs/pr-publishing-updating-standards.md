# Athena PR publishing and updating standards

This document is the source of truth for pull request publishing and update expectations.

## Validation requirements before publishing or updating a PR

1. Run `npm run check` from repository root before creating a PR and before each PR update.
2. Any issue reported by `npm run check` must be fixed before publishing or updating the PR.
3. Run `npm test` from repository root before creating a PR and before each PR update.
4. Any issue reported by `npm test` must be fixed before publishing or updating the PR.
5. A PR update is not complete if either validation command is skipped or still failing.

## PR content requirements

1. Keep the PR focused on a single change set or objective.
2. Include a clear summary of what changed and why, not only from the last push, but about the whole PR.
3. Include test/validation evidence in the PR description (at minimum, `npm run check` and `npm test` outcomes).
4. Update or add relevant documentation when behavior, workflows, or standards change.
5. Include the relevant information and link to the relevant `docs/specs` artifact.
6. If a change is triggered by an external source task (for example Jira ingestion), include that external reference as context only.
7. Map implemented changes to acceptance criteria defined in local specs.

## Update discipline requirements

1. Resolve review feedback with code and validation updates together so the PR stays releasable.
2. Do not commit or push a PR update while required validations are failing.
3. Before each PR update, verify active local spec criteria are still satisfied by the current PR state.
