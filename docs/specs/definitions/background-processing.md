# Background Processing Definition

Athena runs durable background work as PostgreSQL-backed `pg-boss` jobs.

## Topology

- `athena` web units run HTTP and the `pg-boss` producer. `athena-worker` units run all
  durable background handlers. Both scale independently.
- `pg-boss` owns queue mechanics for task iteration, webhook-triggered Workgraph sync,
  remote-runner submission and polling, and RAG indexing.
- Domain records remain the source of truth for task, Workgraph, and runner execution state;
  jobs carry stable identifiers and invoke idempotent domain transitions.
- Each process owns one PostgreSQL pool with explicit limits and timeouts. `pg-boss` uses that
  pool and polls instead of LISTEN/NOTIFY, so the worker can use transaction-mode pooling.
- Web and worker applications each own a standard PostgreSQL client relation and receive separate
  relation users with the provider-supported `admin` role. This follows the usual multi-application
  charm pattern and keeps credential rotation and revocation in the PostgreSQL relation lifecycle.
- Web startup installs Athena and `pg-boss` schema changes and creates the deployed queue catalog.
  Workers do not execute DDL and wait until web preparation is complete before starting handlers.

## Control-flow transfers

- Task creation, user messages, approvals, rejections, Workgraph assignment, and runner results
  enqueue task iteration after committing their domain state.
- Task wake-ups use a `short` queue: at most one wake-up waits while active drains execute. This
  coalesces bursts without losing the follow-up needed when work arrives near the end of a drain.
- Inbound webhooks authenticate synchronously, then enqueue Workgraph synchronization keyed by
  the receiver. A successful sync promotes eligible items to tasks, then enqueues task iteration.
- Runner tool execution creates a `runnerQueue` record and enqueues submission. Submission stores
  the external task identifier before polling begins. Poll completion atomically updates the
  runner record and appends one task message, then enqueues task iteration.
- Processing is event-driven. Each worker startup enqueues task iteration, providing bounded
  recovery for task handoffs missed before that startup. Athena does not periodically scan domain
  tables, so callers must still successfully enqueue each required handoff for prompt processing.

## Delivery

- Delivery is at least once. Handlers must be idempotent.
- Payloads are versioned and validated before side effects.
- Retry limits and backoff are explicit per queue.
- Queue retries must not duplicate task messages, external submissions, or Workgraph task
  promotion. Terminal domain-state writes and their downstream handoff markers are atomic where
  a retry could otherwise split them.

## Lifecycle

- Preparation installs or upgrades the `pg-boss` schema. Web and worker processes verify that it
  exists and fail startup when preparation has not completed.
- Web startup creates queues for the deployed job catalog and applies their mutable settings.
  Worker startup only verifies that each registered handler has a queue with the expected policy;
  workers do not create or update queue definitions.
- On shutdown, web processes stop accepting requests and stop the producer; worker processes
  drain `pg-boss` handlers within a bounded timeout. Each process closes its pool last.
