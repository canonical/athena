# Athena deployment

## Web and worker charms

Athena is deployed as two Juju applications from one OCI image:

- `athena` serves the frontend and HTTP API and owns startup migrations when they are not
  managed externally.
- `athena-worker` runs all background consumers and never runs migrations.

The worker requests its own PostgreSQL role for the database owned by the web application.
Relating the two Athena charms lets the web charm grant that role runtime access without
transferring migration ownership. The only shared secret is the credential encryption key:

```bash
credential_secret=$(juju add-secret athena-worker-credential \
  encryption-key='the-same-key-used-by-athena')
juju deploy ./athena-worker_amd64.charm athena-worker \
  --resource app-image=ghcr.io/canonical/athena:latest \
  --config database-name=athena
juju integrate athena-worker:postgresql postgresql-k8s
juju integrate athena:workers athena-worker:athena
juju grant-secret athena-worker-credential athena-worker
juju config athena-worker credential="$credential_secret"
```

The web charm grants access to existing and future Athena and `pgboss` objects. External
migrations must connect as the same database-owning role used by the web application so those
default privileges apply to newly created objects. Only the web charm or the external migration
workflow installs or upgrades those schemas. The worker waits for the grant handshake before
starting. Scale workers independently with `juju add-unit athena-worker`.

## `VITE_API_BASE_URL`

This note is intentionally scoped to one deployment concern only: frontend API base URL configuration.

## Why this variable matters

Athena frontend code reads `import.meta.env.VITE_API_BASE_URL` in browser-bound code. Because Athena uses Vite, this value is embedded into the frontend bundle at build time.

This means:

- `VITE_API_BASE_URL` is required in the frontend build environment and must be non-empty.
- Changing `VITE_API_BASE_URL` after the bundle is already built does not change the baked client value.

## Recommended deployment usage

Set `VITE_API_BASE_URL` to your backend origin while building frontend assets.

Example:

- Frontend host: `https://athena.example.com`
- Backend host: `https://api.athena.example.com`
- Build-time variable: `VITE_API_BASE_URL=https://api.athena.example.com`

## Local compose requirement

In local Compose, `VITE_API_BASE_URL` should use same-host backend routing via Traefik (default: `/api`, served from `http://athena.localhost`).
