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
- [x] Integration coverage exercises the blocked state and the complete PostgreSQL grant,
  credential, Pebble startup, and active-state path.

## Database authorization decision

The web PostgreSQL relation requests `CREATEROLE`. Athena migrations create one stable, non-login
`athena_worker_runtime` group and grant the group object-level runtime permissions on the
`public` and `pgboss` schemas. The worker PostgreSQL relation requests membership through
`extra_user_roles`.

The current PostgreSQL charm can attach relation users to an existing group but cannot
declaratively create that group, and it exposes no administrative action for doing so. PostgreSQL
also does not allow the non-superuser web role to revoke its own `CREATEROLE`. Retaining that
attribute is an explicit POC trade-off; production hardening should preprovision the runtime group
outside Athena and remove `CREATEROLE` from the web relation.

Deployment and integration tests relate the web charm first and wait for migrations before
relating the worker. PostgreSQL then manages generated worker-user membership and credential
removal, so Athena keeps no per-worker role map or cross-charm grant protocol.

## Related specifications

- [background-processing.md](../definitions/background-processing.md)
- [Athena worker charm](../../../worker-charm/README.md)
