# Background Domain Jobs Migration Plan

## Status

Implemented; external Workgraph and GitHub runner E2E coverage remains pending.

## Scope

Replace web-process polling and detached promises with registered `pg-boss` jobs while retaining
Athena's domain tables and state machines.

## Migration order

1. Register a shared job catalog before producer or worker startup and support worker-side job
  chaining. Web startup owns queue creation and settings; worker startup verifies the resulting
  queue catalog before registering handlers.
2. Move webhook and UI-triggered Workgraph synchronization to one keyed job definition; remove
   the `webhookItem` queue and processor.
3. Move task queue draining to one stately job with immediate triggers; retain task readiness,
  approval, runner-blocking, and claim rules.
4. Keep `runnerQueue` as execution history, but replace its consumer claims and heartbeats with
   submit and poll jobs keyed by runner-queue item. Complete the runner record and append its task
   result in one transaction before resuming task iteration.
5. Remove web-process processor startup/shutdown wiring and obsolete queue columns and indexes.

## Acceptance criteria

- [x] Webhook ingestion returns after authenticating and durably enqueueing keyed Workgraph sync.
- [x] Workgraph sync promotion still creates at most one active task per Workgraph item and
  schedules task iteration.
- [x] Every task-unblocking action schedules task iteration.
- [x] Task wake-ups coalesce to one queued follow-up without rejecting wake-ups solely because a
  drain is already active.
- [x] Runner submission persists its external identifier before polling, and polling completion
  atomically appends exactly one task result.
- [x] No custom polling interval or queue retry counter remains for task, webhook, or runner queue
  mechanics. Task processor ownership remains a domain-level optimistic lock while one iteration
  executes.
- [x] Worker startup enqueues task iteration so deployment or restart drains ready tasks stranded
  by an earlier missed enqueue without adding a periodic reconciliation schedule.
- [x] Only web startup creates or updates queue definitions; workers fail startup when a required
  queue is missing or uses an unexpected policy.
- [x] Worker shutdown drains all migrated handlers; web shutdown has no domain-consumer drain.
- [x] UI-driven E2E covers task response after background iteration.
- [ ] UI-driven E2E covers webhook-triggered promotion with a rendered Jira source flow.
- [ ] UI-driven E2E covers runner-result resume after a rendered workshop-runner completion flow.

## Related specifications

- [Background processing](../definitions/background-processing.md)
- [RAG index plan](./rag-index.plan.md)