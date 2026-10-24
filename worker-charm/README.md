# Athena worker charm

Runs the deployed Athena `pg-boss` catalog from the shared `app-image` rock through the standalone
worker entrypoint. The worker never runs migrations or serves HTTP. Task iteration runs here;
webhook and runner processing remain in the web application until their separate migrations land.

The `credential` secret must hold the web charm's `encryption-key`. The worker relates directly to
PostgreSQL and receives its own generated user with the provider-supported `admin` role. Deploy and
activate the web application first: web startup runs migrations and creates the deployed queue
catalog, while worker startup only verifies queues and registers handlers.

## Deployment

```bash
juju deploy ./athena-worker_amd64.charm athena-worker \
  --resource app-image=ghcr.io/canonical/athena:latest
juju integrate athena postgresql-k8s
juju wait-for application athena --query='status=="active"' --timeout=20m
juju integrate athena-worker:postgresql postgresql-k8s
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

The scenario deploys PostgreSQL and both charms, waits for web preparation, relates worker directly
to PostgreSQL, configures the encryption credential, and verifies that only the `athena-worker`
Pebble service is active in the worker container.
