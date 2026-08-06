# Workgraph Jira POC Plan

## Scope

Implement Workgraph end-to-end as a loop-assignable external hierarchy source.

- Workgraph is a first-class owner-scoped definition.
- Jira is the only selectable Workgraph type in this phase.
- Loop can assign one or more Workgraphs and configure ingestion seed/rules per assignment.
 - Loop can assign one or more Workgraphs and configure ingestion JQL/rules per assignment.

## Data Model

- `workgraph` definition table:
  - owner, displayName, workgraphType (`jira` only), baseUrl, optional projectKey, lifecycle status.
- `loopWorkgraph` assignment table:
  - priority, enabled flag,
  - `jql` text, `assignmentConfig` JSON,
  - sync metadata (`lastSyncedAt`, `lastSyncStatus`, `lastSyncError`).

## API Surface

- Definition APIs:
  - list, get, create, update, delete workgraphs.
  - list available Workgraph types (`jira` only for POC).
- Loop assignment APIs:
  - list loop workgraphs.
  - assign/unassign workgraph to loop.
  - admin update for assignment seed/rules and priority.

## UI Scope

- Top-level Workgraphs section:
  - list, create, edit, delete definitions.
- Loop Workgraphs tab:
  - assign existing workgraph.
  - list assigned workgraphs with sync metadata.
  - edit JQL and assignment rules.

## Constraints

- No legacy compatibility path.
- No provider-specific cache control behavior in this phase.
- Enforce Jira-only type selection in backend validation and frontend option source.

## References

- Concept: [workgraph.md](../../workgraph.md)
- Loop/task lifecycle and processing: [task-lifecycle.md](../../task-lifecycle.md)
