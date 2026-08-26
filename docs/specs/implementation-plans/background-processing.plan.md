# Background Processing Implementation Plan

## Status

Implemented for the Compose deployment and loop-history memory, including domain-keyed
singleton execution and queue-policy validation. Production rollout checks are tracked in
[loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md). Rock and charm
changes remain deferred.

## Objective

Provide a PostgreSQL-backed durable-job facility with atomic enqueueing and a dedicated worker process, without changing how ordinary Athena services use PostgreSQL.

Normative behavior is defined in [background-processing.md](../definitions/background-processing.md).

## Delivered scope

- Pinned `pg-boss` behind `src/components/background-job`.
- Stable, versioned, Zod-validated payload envelopes and a central job registry.
- HTTP-side producer and a separate `src/worker.ts` consumer entrypoint.
- Transaction-aware enqueueing using a shared PostgreSQL query-executor contract.
- Graceful worker shutdown and explicit PostgreSQL pool closure.
- Existing `prepare` service retained for Athena application migrations.
- Separate `pg-boss-prepare` service for dependency-owned migrations.
- Separate `athena-worker` Compose service using the Athena image.
- Default retry count, retry delay, and shutdown timeout configuration.
- Pinned `pg-boss` defaults unless a registered job declares a domain-specific queue
	policy; loop-memory jobs use keyed `singleton` execution.
- Compose-backed E2E startup waits for the worker.

## Database integration

The PostgreSQL component retains its original pool and `query()` interfaces. It adds `QueryExecutor`, the minimal `query` contract shared by a pool and checked-out client; `withTransaction()`, which manages transaction completion and client release; and `closePG()`, which the worker uses during shutdown.

Only flows that require atomic enqueueing use `withTransaction()`. The producer passes that transaction to `pg-boss` through its supported database adapter. Feature code never writes dependency tables directly.

## Runtime sequence

1. PostgreSQL starts with the pgvector-capable PostgreSQL 16 image.
2. `prepare` applies Athena migrations, including the vector extension.
3. `pg-boss-prepare` applies the schema required by the pinned dependency.
4. `athena` starts the producer and HTTP application.
5. `athena-worker` starts the registered consumers.

Runtime processes disable automatic `pg-boss` schema creation and migration.

## Configuration

- `APP_ATHENA_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS`, default `30000`.
- `APP_ATHENA_BACKGROUND_JOB_RETRY_LIMIT`, default `3`.
- `APP_ATHENA_BACKGROUND_JOB_RETRY_DELAY_SECONDS`, default `5`.

No global concurrency, schema-name, expiration, or retention settings are exposed.
Registered job types may override retry or queue policy when their domain invariants
require it. Loop-history backfills and incremental ingestion use keyed `singleton`
execution without adding a global worker-concurrency setting.

## Registered jobs

- `loop-memory.backfill`, payload version 1: `{ loop, generation }`.
- `loop-memory.ingest`, payload version 1: `{ loop, task, queueItem? }`.

The backfill job embeds bounded batches, heartbeats its lease, and checks abort and
generation guards between provider calls. The ingestion job supports efficient single-item
append handling and task-wide refresh after compaction, status changes, approval, or
rejection.

## Validation completed

- Static type, formatting, and lint checks.
- Production backend and frontend builds.
- Fresh Compose schema preparation with pgvector and `pg-boss`.
- UI-driven enable, persistence, disable, backfill, and cross-task `own-memory-lookup` scenarios.

## Deferred scope

- Rock and charm worker supervision.
- Generic standalone RAG jobs for Markdown or other source adapters.
- Explicit concurrency tuning, scheduling, progress percentages, and operational UI.
- Migration of existing task, webhook, and runner processors to the durable-job facility.

The domain-specific backfill serialization and generation-fencing work is tracked in
[loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md), not as generic
worker concurrency tuning.

## Acceptance criteria

1. Both schema preparation services complete before either runtime starts.
2. Domain changes and required job insertion share one transaction.
3. HTTP and worker entrypoints have distinct responsibilities.
4. Invalid payloads and unsupported versions fail permanently.
5. Retryable failures receive bounded retries.
6. Feature lifecycle is observable without queue-table access.
7. Existing Athena PostgreSQL consumers retain their prior access patterns.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [rag-index.md](../definitions/rag-index.md)
- [rag-index.plan.md](./rag-index.plan.md)
- [loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md)
- [database-standards.md](../../database-standards.md)
- [testing-standards.md](../../testing-standards.md)
