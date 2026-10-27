# Background Runner Processing Plan

## Status

Implemented.

## Scope

Move GitHub Copilot Cloud submission and polling from the web process to durable `pg-boss` jobs in
the standalone worker. Preserve the runner queue as execution history and resume the originating
task exactly once when the external execution reaches a terminal state.

## Acceptance criteria

- [x] The deployed job catalog registers versioned, schema-validated `runner.submit` and
  `runner.poll` jobs.
- [x] Creating an Athena-consumed runner queue item and enqueueing its submission commit in one
  PostgreSQL transaction.
- [x] Submission persists the external task ID before scheduling the first poll.
- [x] Submission and polling use stately queues keyed by runner queue item so duplicate handoffs
  coalesce.
- [x] Terminal success or failure updates runner history and appends one idempotent task message in
  one transaction, then hands the resumed task to `task.process`.
- [x] Ambiguous interrupted submissions fail safely instead of submitting the same external work a
  second time.
- [x] Worker startup recovers pending submissions and claimed executions that already have an
  external task ID.
- [x] Web no longer starts or drains the legacy runner queue consumer.
- [x] UI-driven E2E verifies that submission executes in the worker and a terminal failure resumes
  the task.

## Deferred cleanup

The disconnected runner consumer, its claim and heartbeat query helpers, and the legacy
`claimedBy`, `claimedAt`, and `consumerPingedAt` columns remain until the stack's dedicated
legacy-cleanup branch. Keeping removal separate makes the worker cutover independently reviewable
and leaves rollback data intact.

## Related specifications

- [Background processing](../definitions/background-processing.md)
- [Runner and harness](../definitions/runner-harness.md)
- [Runner connection](./runner-connection.plan.md)
