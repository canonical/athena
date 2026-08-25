# Background Processing Definition

## Purpose

Athena uses durable background jobs for deterministic work that should not hold an HTTP request open, may outlive a runtime process, or requires bounded retries. Loop-history indexing is the first consumer.

Queue rows are operational infrastructure. Features remain responsible for storing and exposing their own lifecycle and failure state.

## Runtime model

- Jobs are stored in Athena's PostgreSQL database through pinned `pg-boss`.
- The HTTP process produces registered jobs but never executes their handlers.
- A separate `athena-worker` process executes handlers from the same Athena image.
- Athena's `background-job` component owns the `pg-boss` dependency, typed registry, payload validation, producer, and worker integration. Feature components do not import `pg-boss` or query its tables.
- The dependency-owned `pgboss` schema is not governed by Athena application-table naming rules in [database-standards.md](../../database-standards.md).
- Queue concurrency uses the pinned library's defaults. Athena currently exposes no worker-concurrency setting.

## Schema preparation and deployment

- Athena application migrations remain centralized in the existing `prepare` service.
- A separate one-shot `pg-boss-prepare` service runs the pinned `pg-boss migrate` command.
- Both preparation services must complete successfully before `athena` and `athena-worker` start.
- `athena-worker` has no HTTP listener, published port, or Traefik labels.
- The worker receives only backend configuration needed for PostgreSQL, credential decryption, shutdown, and retry policy.
- Rock and charm integration is deferred to a separate deployment change.

## Job contract

Every registered job defines:

- A stable name.
- A positive payload version and Zod-validated payload.
- An idempotent handler.
- A singleton key only when dropping duplicate active work is safe.
- Policy overrides only when behavior must differ from `pg-boss` defaults.

Payloads contain domain references rather than credentials or unnecessary source content. Handlers resolve encrypted credentials at execution time and never log them. Unsupported versions and invalid payloads are permanent failures; retryable handler errors use bounded retry and backoff policy.

## Transactional enqueueing

When a domain mutation requires a job, both operations must share one PostgreSQL transaction. Athena passes a transaction-scoped query executor to the producer, which uses `pg-boss`'s supported database adapter rather than inserting into queue tables.

Ordinary Athena database work continues using the existing pool and query APIs. The transaction helper is used only by flows that must atomically persist domain state and enqueue background work.

## Worker lifecycle

- Startup validates the registry, starts `pg-boss`, ensures registered queues exist, and registers handlers.
- Duplicate registered names fail startup.
- Structured logs identify job name, job id, attempt, payload version, and outcome.
- `SIGTERM` and `SIGINT` stop claims, allow a bounded graceful drain, stop `pg-boss`, and close the PostgreSQL pool.
- Startup and uncaught runtime failures exit non-zero for external supervision.

## Implemented jobs

- `loop-memory.backfill`: indexes every persisted live and archived queue item belonging to one loop. Embedding requests are processed in batches of 50.
- `loop-memory.ingest`: indexes one newly appended queue item or refreshes all entries for one task after a mutation affecting existing or multiple history items.

Both handlers are idempotent through the loop/task/queue-item identity and no-op after history memory is disabled. Feature state records `missing`, `indexing`, `ready`, or `failed`; disabled retained indexes are `missing`. See [rag-index.md](./rag-index.md) for the loop-memory contract.

Generic standalone RAG rebuild and embedding jobs are future work; they are not part of the current registry.

## Testing

Compose-backed Playwright tests start both preparation services and the worker. Tests observe feature state through the rendered UI and exercise real provider, embedding, queue, worker, and retrieval paths without reading queue tables.

## Acceptance criteria

1. Domain state and required job insertion commit or roll back together.
2. The HTTP process does not execute handlers and the worker does not open HTTP routes.
3. Registered payloads are versioned and validated before feature code executes.
4. Retry or duplicate delivery does not duplicate effective feature state.
5. Feature APIs expose lifecycle and failure without exposing dependency-owned tables.
6. Compose prepares both schemas and runs the worker as a distinct service.

## References

- Implementation plan: [background-processing.plan.md](../implementation-plans/background-processing.plan.md)
- RAG behavior: [rag-index.md](./rag-index.md)
- Database rules: [database-standards.md](../../database-standards.md)
- Testing rules: [testing-standards.md](../../testing-standards.md)
