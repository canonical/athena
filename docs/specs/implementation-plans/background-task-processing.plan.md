# Background Task Processing Plan

## Status

Implemented.

## Scope

Move task iteration from the web process's polling loop to one durable `pg-boss` job while
preserving the existing task state machine, optimistic processor claims, and user-visible behavior.
Webhook and runner processing remain in the web process for their separate migrations.

## Acceptance criteria

- [x] The deployed job catalog registers a versioned, schema-validated `task.process` job.
- [x] Task creation, user messages, approvals, rejections, Workgraph assignment, and runner results
  enqueue task processing through the existing trigger boundary.
- [x] The queue coalesces bursts while retaining one follow-up wake-up during an active drain.
- [x] Only the worker executes task iteration; web no longer starts or drains a task processor.
- [x] Worker startup enqueues task processing to recover ready tasks stranded by a missed handoff.
- [x] Task claims continue to use the background job identifier as processor ownership and retain
  heartbeat and stale-claim recovery behavior.
- [x] Existing UI-driven task conversation coverage passes with processing owned by the worker.

## Delivery semantics

The `short` queue policy permits one queued wake-up and any active drain. Each handler repeatedly
claims and processes ready tasks until none remain. A wake-up arriving during that drain is retained
as the next queued job, covering work committed near the end of the active handler without restoring
periodic polling.

The domain tables remain the source of truth. The job payload is empty because a drain discovers
ready tasks through the existing claim query; the job identifier supplies the processor claim owner.

## Related specifications

- [Background processing](../definitions/background-processing.md)
- [Task iteration](../../task-iteration.md)
- [Background worker charm](./background-worker-charm.plan.md)
