# Background Domain Jobs Migration Plan

## Status

Implemented; external Workgraph and GitHub runner E2E coverage remains pending.

## Scope

Replace web-process polling and detached promises with registered `pg-boss` jobs while retaining
Athena's domain tables and state machines.

## Migration order

1. Register a shared job catalog before producer or worker startup and support worker-side job
   chaining.
2. Move webhook and UI-triggered Workgraph synchronization to one keyed job definition; remove
   the `webhookItem` queue and processor.
3. Move task queue draining to one stately job with immediate triggers and scheduled
   reconciliation; retain task readiness, approval, runner-blocking, and claim rules.
4. Keep `runnerQueue` as execution history, but replace its consumer claims and heartbeats with
   submit and poll jobs keyed by runner-queue item. Complete the runner record and append its task
   result in one transaction before resuming task iteration.
5. Remove web-process processor startup/shutdown wiring and obsolete queue columns and indexes.

## Acceptance criteria

- [x] Webhook ingestion returns after authenticating and durably enqueueing keyed Workgraph sync.
- [x] Workgraph sync promotion still creates at most one active task per Workgraph item and
  schedules task iteration.
- [x] Every task-unblocking action schedules task iteration, and reconciliation eventually finds
  committed work after a missed enqueue.
- [x] Runner submission persists its external identifier before polling, and polling completion
  atomically appends exactly one task result.
- [x] No custom polling interval or queue retry counter remains for task, webhook, or runner queue
  mechanics. Task processor ownership remains a domain-level optimistic lock while one iteration
  executes and is recovered by the scheduled task job.
- [x] Worker shutdown drains all migrated handlers; web shutdown has no domain-consumer drain.
- [ ] UI-driven E2E scenarios cover task response, webhook promotion, and runner result resume.

## Related specifications

- [Background processing](../definitions/background-processing.md)
- [RAG index plan](./rag-index.plan.md)