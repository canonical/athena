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
- Migrations own a stable non-login `athena_worker_runtime` PostgreSQL group. Worker relation
  users receive membership from PostgreSQL and do not own or migrate schemas. The web relation
  currently retains `CREATEROLE` to provision that group; production should preprovision it and
  remove that attribute.

## Control-flow transfers

- Task creation, user messages, approvals, rejections, Workgraph assignment, and runner results
  enqueue task iteration after committing their domain state.
- Inbound webhooks authenticate synchronously, then enqueue Workgraph synchronization keyed by
  the receiver. A successful sync promotes eligible items to tasks, then enqueues task iteration.
- Runner tool execution creates a `runnerQueue` record and enqueues submission. Submission stores
  the external task identifier before polling begins. Poll completion atomically updates the
  runner record and appends one task message, then enqueues task iteration.
- Periodic pg-boss reconciliation jobs recover the narrow window where domain state commits but
  process failure prevents the immediate enqueue. Reconciliation never performs domain work
  directly and uses singleton keys to avoid duplicate active chains.

## Delivery

- Delivery is at least once. Handlers must be idempotent.
- Payloads are versioned and validated before side effects.
- Retry limits and backoff are explicit per queue.
- Queue retries must not duplicate task messages, external submissions, or Workgraph task
  promotion. Terminal domain-state writes and their downstream handoff markers are atomic where
  a retry could otherwise split them.

## Lifecycle

- Web processes install or upgrade the `pg-boss` schema. Workers never migrate and fail startup
  until the schema exists.
- On shutdown, web processes stop accepting requests and stop the producer; worker processes
  drain `pg-boss` handlers within a bounded timeout. Each process closes its pool last.
