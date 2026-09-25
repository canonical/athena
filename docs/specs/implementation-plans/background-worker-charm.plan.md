# Background Worker Charm Plan

## Status

Implemented.

## Scope

Run `pg-boss` background jobs outside the Athena HTTP process in an independently
deployable and scalable `athena-worker` Juju charm while retaining one shared application
rock.

## Acceptance criteria

- [x] The HTTP entrypoint keeps the task, webhook, and runner consumers and starts the
  `pg-boss` producer, which installs or upgrades its schema.
- [x] The worker entrypoint initializes the `pg-boss` worker runtime for the registered job catalog.
- [x] Worker shutdown drains active `pg-boss` jobs within the configured shutdown timeout
  before closing PostgreSQL.
- [x] The web charm runs only the HTTP Pebble service.
- [x] A separate worker charm starts `npm run start:worker` from the shared rock.
- [x] The worker manages its own PostgreSQL relation and role, while credential access uses
  an explicit Juju secret and no web-only OIDC, session, frontend, ingress, or port configuration.
- [x] The worker never runs Athena or `pg-boss` migrations.
- [x] Release automation versions, packs, and publishes both charms.
- [x] Deployment automation deploys or refreshes both applications.
- [x] Local Compose and Playwright run web and worker as separate services.

## Operational dependencies

`ATHENA_POSTGRESQL_APPLICATION` must identify the worker's transaction-mode PgBouncer
application and `ATHENA_WORKER_CREDENTIAL_SECRET` must identify the shared credential
encryption secret in each GitHub deployment environment. The web application keeps its
session-mode PgBouncer. Deployment relates the worker to its PgBouncer and to Athena, then
grants the credential secret. Schema migrations remain owned by Athena and must complete
before worker units process jobs.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [deployment.md](../../deployment.md)
