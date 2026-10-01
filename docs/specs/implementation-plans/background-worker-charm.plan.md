# Background Worker Charm Plan

## Status

Implemented.

## Scope

Run `pg-boss` jobs in a separate, independently scalable `athena-worker` charm built from the
shared rock.

## Acceptance criteria

- [x] The worker charm starts `npm run start:worker`; the web charm runs only HTTP.
- [x] The worker has its own PostgreSQL relation and gets the credential key from a Juju secret.
- [x] The worker never runs migrations.
- [x] Release and deployment automation handle both charms.
- [x] Compose and Playwright run web and worker as separate services.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [Athena worker charm](../../../worker-charm/README.md)
