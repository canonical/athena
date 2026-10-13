# Background Worker Charm Plan

## Status

Implemented.

## Scope

Run `pg-boss` jobs in a separate, independently scalable `athena-worker` charm built from the
shared rock.

## Acceptance criteria

- [x] The worker charm starts `npm run start:worker`; the web charm runs only HTTP.
- [x] The worker has its own standard PostgreSQL relation and gets the credential key from a Juju
    secret.
- [x] The worker never runs migrations.
- [x] Release and deployment automation handle both charms.
- [x] Compose and Playwright run web and worker as separate services.
- [x] Integration coverage exercises the blocked state and the complete PostgreSQL grant,
  credential, Pebble startup, and active-state path.

## Database authorization decision

Web and worker applications each relate directly to PostgreSQL and receive separate generated
users with the provider-supported `admin` role. This matches the established multi-application
charm pattern: PostgreSQL owns credential creation, rotation, and revocation, while Athena avoids
custom credential forwarding and per-user grant choreography.

Only web performs migrations and queue registration. Deployment and integration tests relate web
first and wait for it to become active before relating worker. Worker startup verifies the
`pg-boss` schema and deployed queue policies, and fails closed if preparation is incomplete.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [Athena worker charm](../../../worker-charm/README.md)
