# Background Processing Definition

Athena uses PostgreSQL-backed `pg-boss` jobs as the durable background-processing substrate.

## Job contract

- Each job definition has a stable queue name, positive payload version, Zod payload schema,
  queue settings, worker settings, and asynchronous handler.
- Definitions register before startup. Startup seals the catalog and rejects duplicate or late
  registrations.
- Producers validate payloads before enqueueing. Workers validate the envelope version and payload
  again before invoking a handler.
- Invalid or explicitly permanent work is dead-lettered. Other handler failures use the queue's
  configured retry limit and backoff.
- Callers may enqueue through an existing PostgreSQL transaction when a domain write and its job
  handoff must commit atomically.

## Process responsibilities

- The web process starts the producer, verifies the prepared `pg-boss` schema, and creates or
  updates queues declared by the deployed catalog.
- The standalone worker verifies the schema and declared queue policies before registering
  handlers. It never creates schemas or queues.
- Production runs the worker in an independently scalable `athena-worker` charm. Its inherited HTTP
  service stays disabled even while PostgreSQL or credential dependencies are unavailable.
- Both processes use Athena's PostgreSQL pool with explicit connection limits and shutdown
  timeouts.
- Preparation installs Athena migrations first and then migrates the configured `pg-boss` schema.
- The web application's PostgreSQL relation requests the provider-supported `admin` role because
  web preparation owns Athena and `pg-boss` schema changes.

## Staged adoption

Task iteration runs as the `task.process` job in the standalone worker. Task creation and every
task-unblocking action enqueue a wake-up after committing domain state. The queue uses the `short`
policy with one local handler: at most one wake-up waits while an active drain continues, so bursts
coalesce without losing the follow-up needed for work arriving near the end of a drain. Worker
startup also enqueues a wake-up as bounded recovery for a handoff missed before startup.

Webhook and runner processors continue to run in the web process until their individual migration
plans are delivered.

Domain migrations must add their queue definition, enqueue points, idempotency behavior, recovery
path, and UI-driven E2E coverage together before removing the corresponding legacy processor.
