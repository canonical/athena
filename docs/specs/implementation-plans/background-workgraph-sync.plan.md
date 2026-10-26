# Background Workgraph Sync Plan

## Status

Implemented.

## Scope

Move UI- and webhook-triggered Workgraph synchronization from detached web-process work to one
durable `pg-boss` job. Preserve the existing Jira synchronization, assignment status, and
idempotent task-promotion behavior. Runner processing remains in the web process.

## Acceptance criteria

- [x] The deployed job catalog registers a versioned, schema-validated `workgraph.sync` job.
- [x] Manual sync marks the assignment and enqueues the job in one PostgreSQL transaction.
- [x] Inbound webhooks authenticate synchronously, then enqueue by receiver without retaining the
  request body in Athena's legacy webhook queue.
- [x] Jobs are keyed by loop and Workgraph and use a stately queue to coalesce duplicate triggers.
- [x] A webhook-triggered job revalidates that its receiver is active and still targets the same
  assignment before accessing the external source.
- [x] Failures update the assignment's sync status before pg-boss applies its configured retry.
- [x] Successful synchronization retains idempotent item replacement and task promotion, with new
  tasks handed to `task.process`.
- [x] Web no longer starts or drains the legacy webhook processor.
- [x] UI-driven E2E verifies that a scheduled sync executes in the worker and renders its terminal
  failure state.

## Deferred cleanup

The unused `webhookItem` table, schema types, query helpers, and processor module remain until the
stack's dedicated legacy-cleanup branch. Keeping removal separate makes this behavioral migration
reviewable and avoids combining queue cutover with destructive schema cleanup.

## Related specifications

- [Background processing](../definitions/background-processing.md)
- [Workgraph](../../workgraph.md)
- [Task promotion decision tree](../../workgraph-sync-task-promotion-decision-tree.md)
