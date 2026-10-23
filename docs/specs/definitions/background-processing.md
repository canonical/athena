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
- Both processes use Athena's PostgreSQL pool with explicit connection limits and shutdown
  timeouts.
- Preparation installs Athena migrations first and then migrates the configured `pg-boss` schema.
- The web application's PostgreSQL relation requests the provider-supported `admin` role because
  web preparation owns Athena and `pg-boss` schema changes.

## Staged adoption

The substrate initially ships with an empty domain-job catalog. Existing task, webhook, and runner
processors continue to run in the web process until their individual migration plans are delivered.
The separate worker therefore starts idle during this phase. This preserves current behavior while
deployment and lifecycle wiring are validated independently of domain migrations.

Domain migrations must add their queue definition, enqueue points, idempotency behavior, recovery
path, and UI-driven E2E coverage together before removing the corresponding legacy processor.
