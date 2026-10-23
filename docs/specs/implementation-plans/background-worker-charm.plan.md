# Background Worker Charm Plan

## Status

Implemented. The deployed domain-job catalog remains empty until the processor migration plans are
delivered.

## Scope

Deploy the standalone `pg-boss` worker as a separate, independently scalable `athena-worker` charm
built from the shared rock without changing current domain processing behavior.

## Acceptance criteria

- [x] The worker charm starts the standalone Node worker and disables the inherited HTTP service before
  checking runtime dependencies.
- [x] The worker has its own standard PostgreSQL relation and gets the credential key from a Juju
  secret.
- [x] The worker never runs migrations or creates queues.
- [x] Release and deployment automation package and deploy both charms.
- [x] Deployment activates web preparation before relating and activating the worker.
- [x] Integration coverage exercises the blocked state, disabled HTTP service, complete PostgreSQL
  and credential path, worker startup, and active state.
- [x] Existing task, webhook, and runner processors remain in the web process.

## Database authorization decision

Web and worker applications each relate directly to PostgreSQL and receive separate generated
users with the provider-supported `admin` role. PostgreSQL owns credential creation, rotation, and
revocation for each application.

Only web performs migrations and queue registration. Deployment and integration tests relate web
first and wait for it to become active before relating worker. Worker startup verifies the
`pg-boss` schema and deployed queue policies, and fails closed if preparation is incomplete.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [Athena worker charm](../../../worker-charm/README.md)
