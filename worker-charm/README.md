# Athena worker charm

This charm runs Athena background processing separately from the HTTP application. It uses
the same `app-image` rock as the web charm and starts `npm run start:worker`.

## Database and secret ownership

The worker relates directly to PostgreSQL and receives its own role and connection details.
Relate its `athena` endpoint to the web charm's `workers` endpoint so that Athena can grant
that role access to its tables, sequences, and `pgboss` schema. Athena remains the sole owner
of schema creation and migrations; the worker never runs migrations.

The `credential` secret must contain the same `encryption-key` configured on the web charm.
The worker uses it when a queued operation needs provider, runner, repository, or Workgraph
credentials.

Juju model HTTP, HTTPS, and no-proxy settings are forwarded to the worker workload for
provider, runner, repository, and Workgraph requests.

See [deployment.md](../docs/deployment.md) for deployment commands and migration ownership.
