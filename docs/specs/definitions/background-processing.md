# Background Processing Definition

## Purpose

Athena uses PostgreSQL-backed `pg-boss` jobs for durable work that must execute outside
HTTP request handling. Background jobs are execution infrastructure and do not change task
ownership, routing, or approval semantics.

## Runtime topology

Production runs three Athena Juju units. Every unit runs an `athena-web` service and an
`athena-worker` service against the same PostgreSQL database and `pg-boss` schema.

- Scheduling and processing must not depend on Juju leadership or one permanent unit.
- Every worker registers the same versioned job catalog.
- PostgreSQL job state and timestamps are authoritative across units.
- `pg-boss` claims coordinate competing workers through PostgreSQL.
- Per-process concurrency contributes to cluster concurrency. A local concurrency of two
  across three units permits up to six jobs unless a queue-level global limit applies.

## Connection ownership

Each web or worker process owns one PostgreSQL pool. The worker's `pg-boss` instance uses
its process pool through the database adapter instead of opening another pool. Pools must
have explicit limits, connection timeouts, idle timeouts, and process-specific application
names.

With one web process and one worker process on each of three units, the default pool limit
of one permits at most six steady-state application connections. Deployment configuration
must reserve additional migration and operational headroom within the related PostgreSQL
application's connection limit.

The shared adapter uses polling and does not enable `pg-boss` LISTEN/NOTIFY, avoiding its
dedicated session connection. This keeps transaction-mode pooling compatible with the
background-processing path.

## Delivery and concurrency

Job delivery is at least once. A claimed handler can run again after worker loss, lease
expiry, or retry. Side-effecting handlers must therefore use a stable operation key and a
transactional domain guard so repeated execution cannot apply the same transition twice.

- Enqueue keys derive from job kind, owning entity, and operation revision.
- Queue and group concurrency limits are database-backed when they must apply across all
  units; in-memory process flags are not cluster locks.
- Payloads are schema-versioned and validated before handler side effects.
- Retry limits, backoff, expiration, and retention are explicit per queue.
- Cancellation is persisted and handlers re-check terminal state before side effects.

The existing `runnerQueue` remains a separate domain queue for external runner tasks.

## Schema and lifecycle

The `pg-boss` version is pinned. Runtime web and worker processes do not create or migrate
its schema. Deployment migration runs install or upgrade the schema before services start;
PostgreSQL advisory locking serializes concurrent migration attempts.

On shutdown, a process stops accepting new work, drains active handlers within a bounded
timeout, stops its `pg-boss` client, and closes its domain PostgreSQL pool. A database
outage must never fall back to an in-memory queue.