# Background Job Substrate Plan

## Status

Implemented. Domain processors have not yet migrated to the substrate.

## Scope

Introduce the shared `pg-boss` job contract and a separately runnable worker without changing
which process currently executes task, webhook, or runner domain work.

## Acceptance criteria

- [x] Preparation installs Athena migrations and the configured `pg-boss` schema.
- [x] The web charm requests the PostgreSQL provider's supported `admin` role required for schema
  preparation.
- [x] The web process starts a producer that owns queue creation and mutable queue settings.
- [x] The standalone worker verifies prepared schema and queue policy without executing DDL.
- [x] Jobs use versioned, schema-validated payload envelopes and explicit retry configuration.
- [x] Enqueue supports participation in an existing PostgreSQL transaction.
- [x] Web and worker processes use independently configurable PostgreSQL pools.
- [x] Compose starts the worker with an empty domain-job catalog while existing processors remain
  in the web process.
- [x] Web shutdown drains existing processors before closing the producer and PostgreSQL pool.
- [x] Worker shutdown drains registered handlers before closing its PostgreSQL pool.
- [x] Playwright stack setup starts the worker and coverage collection includes the worker process.

## Out of scope

- Juju worker charm packaging and deployment.
- Task iteration migration.
- Workgraph synchronization migration.
- Runner submission and polling migration.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
