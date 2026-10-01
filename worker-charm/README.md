# Athena worker charm

Runs Athena `pg-boss` jobs from the shared `app-image` rock with `npm run start:worker`. The
worker never runs migrations.

The `credential` secret must hold the web charm's `encryption-key`. Relating `athena:workers`
grants the worker's PostgreSQL role access to Athena tables and the `pgboss` schema.

## Deployment

```bash
juju deploy pgbouncer-k8s pgbouncer-worker --trust --config pool_mode=transaction
juju integrate pgbouncer-worker postgresql-k8s
juju deploy ./athena-worker_amd64.charm athena-worker \
  --resource app-image=ghcr.io/canonical/athena:latest
juju integrate athena-worker:postgresql pgbouncer-worker
juju integrate athena:workers athena-worker:athena
secret=$(juju add-secret athena-worker-credential encryption-key='<athena key>')
juju grant-secret athena-worker-credential athena-worker
juju config athena-worker credential="$secret"
```
