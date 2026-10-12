# Athena worker charm

Runs Athena `pg-boss` jobs from the shared `app-image` rock with `npm run start:worker`. The
worker never runs migrations.

The `credential` secret must hold the web charm's `encryption-key`. The worker PostgreSQL
relation requests membership in the migration-owned
`athena_worker_runtime` group. Relate the web charm first so its migrations create and grant the
group before PostgreSQL provisions the worker relation user.

## Deployment

```bash
juju deploy pgbouncer-k8s pgbouncer-worker --trust --config pool_mode=transaction
juju integrate pgbouncer-worker postgresql-k8s
juju deploy ./athena-worker_amd64.charm athena-worker \
  --resource app-image=ghcr.io/canonical/athena:latest
juju integrate athena postgresql-k8s
juju wait-for application athena --query='status=="active"' --timeout=20m
juju integrate athena-worker:postgresql pgbouncer-worker
secret=$(juju add-secret athena-worker-credential encryption-key='<athena key>')
juju grant-secret athena-worker-credential athena-worker
juju config athena-worker credential="$secret"
```

## Integration test

Pack both charms and provide the shared OCI image before running the integration environment:

```bash
ATHENA_APP_IMAGE=localhost:32000/athena:test \
ATHENA_WEB_CHARM_PATH=../charm/athena_amd64.charm \
CHARM_PATH=./athena-worker_amd64.charm \
tox -e integration
```

The scenario deploys PostgreSQL and both charms, waits for the web migration to create the runtime
group, configures shared credentials, exercises worker group membership, and verifies that only
the `athena-worker` Pebble service is active in the worker container.
