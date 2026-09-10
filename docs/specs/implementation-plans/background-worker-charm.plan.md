# Background Worker Charm Plan

## Status

Implemented.

## Scope

Separate all background processing from the Athena HTTP process into an independently
deployable and scalable `athena-worker` Juju charm while retaining one shared application
rock and the existing PostgreSQL-backed queue semantics.

## Acceptance criteria

- [x] The HTTP entrypoint does not import, start, or trigger background consumers.
- [x] The worker entrypoint starts task and runner consumers and initializes the `pg-boss`
  worker runtime for the registered job catalog, including webhook processing.
- [x] Worker shutdown stops new task and runner polling cycles, then drains active `pg-boss`
  jobs within the configured shutdown timeout before closing PostgreSQL.
- [x] The web charm runs only the HTTP Pebble service.
- [x] A separate worker charm starts `npm run start:worker` from the shared rock.
- [x] The worker manages its own PostgreSQL relation and role, while credential access uses
  an explicit Juju secret and no web-only OIDC, session, frontend, ingress, or port configuration.
- [x] The worker never runs Athena or `pg-boss` migrations.
- [x] Release automation versions, packs, and publishes both charms.
- [x] Deployment automation deploys or refreshes both applications.
- [x] Local Compose and Playwright run web and worker as separate services.

## Operational dependencies

`ATHENA_POSTGRESQL_APPLICATION` must identify the existing PostgreSQL provider and
`ATHENA_WORKER_CREDENTIAL_SECRET` must identify the shared credential encryption secret in
each GitHub deployment environment. Deployment relates the worker to PostgreSQL and Athena,
then grants the credential secret. Schema migrations remain owned by Athena and must complete
before worker units process jobs.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [deployment.md](../../deployment.md)
