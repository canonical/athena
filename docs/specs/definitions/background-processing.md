# Background Processing Definition

## Purpose

Athena uses PostgreSQL-backed `pg-boss` jobs for durable work that must execute outside
HTTP request handling. Background jobs are execution infrastructure and do not change task
ownership, routing, or approval semantics.

## Runtime topology

Production runs separate `athena` and `athena-worker` Juju applications. Web units run
only the HTTP service; worker units run task, webhook, and runner processing plus the
`pg-boss` runtime
against the same PostgreSQL database and `pg-boss` schema.

- Web and worker applications scale independently.
- Scheduling and processing must not depend on Juju leadership or one permanent worker.
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

With three web units and three worker units, the default pool limit of one permits at most
six steady-state application connections. Deployment configuration must reserve additional
migration and operational headroom within the PostgreSQL connection limit.

The worker charm owns a `postgresql_client` relation and receives an independently managed
role and connection from the PostgreSQL provider. A separate relation to the Athena web charm
reports that role. Athena grants it runtime access to the Athena and `pgboss` objects and
revokes those grants when the relation is removed. The worker never creates database objects
or runs migrations; schema and migration ownership stays fully with Athena.

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
- Domain queue claims record their claim time and recover abandoned work after the stale
  claim interval.

The existing `runnerQueue` remains a separate domain queue for external runner tasks.
The task and runner queues remain PostgreSQL-backed domain queues while their handlers are
moved behind the worker process boundary. Authenticated webhook deliveries enqueue a versioned
`pg-boss` job keyed by receiver, and the HTTP handler never invokes an in-process consumer.

## Schema and lifecycle

The `pg-boss` version is pinned. Runtime web and worker processes do not create or migrate
its schema. The web charm or external deployment migration installs or upgrades the schema
before worker services start;
PostgreSQL advisory locking serializes concurrent migration attempts.

On shutdown, a process stops scheduling task and runner polling cycles. Its `pg-boss` client
stops accepting new background jobs and drains active background-job handlers within a bounded
timeout before the domain PostgreSQL pool closes. A database outage must never fall back to an
in-memory queue.
