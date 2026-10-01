# Background Processing Definition

Athena runs durable background work as PostgreSQL-backed `pg-boss` jobs.

## Topology

- `athena` web units run HTTP, the task, webhook, and runner domain queues, and the `pg-boss`
  producer. `athena-worker` units run `pg-boss` handlers. Both scale independently.
- `pg-boss` jobs are reserved for RAG indexing.
- Each process owns one PostgreSQL pool with explicit limits and timeouts. `pg-boss` uses that
  pool and polls instead of LISTEN/NOTIFY, so the worker can use transaction-mode pooling.

## Delivery

- Delivery is at least once. Handlers must be idempotent.
- Payloads are versioned and validated before side effects.
- Retry limits and backoff are explicit per queue.

## Lifecycle

- Web processes install or upgrade the `pg-boss` schema. Workers never migrate and fail startup
  until the schema exists.
- On shutdown, a process stops scheduling domain queue cycles, waits for in-flight cycles and
  `pg-boss` handlers within a bounded timeout, then closes its pool.
