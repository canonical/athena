# Athena

Athena is a multi-agent orchestration service. This repository is the bootstrap workspace for the service runtime, packaging, and deployment artifacts.

At the moment, the implementation is still early-stage. The application now includes a first OIDC-backed session authentication flow alongside bootstrap packaging files.

## Current status

- Service name: Athena
- Version: 0.0.1
- Runtime: Node.js and TypeScript in [app](./app)
- Packaging: Rockcraft in [rockcraft.yaml](./rockcraft.yaml)
- Operator packaging: Juju charm in [charm](./charm)
- Current API surface: `GET /_status/check`

## Repository layout

- [app](./app): Express-based Athena service, personas, definitions, and database migrations for the application runtime.
- [charm](./charm): Juju charm sources for deploying Athena.
- [migrations](./migrations): Repository-level PostgreSQL schema and seed files.
- [rockcraft.yaml](./rockcraft.yaml): Rock packaging definition for Athena.

## Coding standards

Athena uses a co-located, flat component structure in [app/src/components](./app/src/components): frontend and backend files for the same feature live side-by-side in the same component folder, and component folders contain files only.

See [docs/coding-standards.md](./docs/coding-standards.md) for the canonical rules, including file move conventions.

## What the app does today

The current service starts an Express server with session-based authentication:

- Frontend route:
	- `GET /authentication`: React authentication view that allows sign-in and sign-out via backend auth endpoints.

- Public health endpoints:
  - `GET /_status/check`
  - `GET /_status/ping`
- Public auth endpoints:
  - `GET /authentication/login`
  - `GET /authentication/callback`
  - `GET /authentication/logout`
  - `GET /authentication/profile`
- Backend route policy:
  - Non-public backend routes require an authenticated session.
  - Unauthenticated requests return HTTP `401 Unauthorized`.
  - Static assets are not served by the Express backend.

## Local development

The application code lives under [app](./app).

Install dependencies:

```bash
cd app
npm install
```

Run the TypeScript watcher for local development:

```bash
cd app
npm run watch
```

Build the service:

```bash
cd app
npm run build
```

Start the built service:

```bash
cd app
npm run start
```

Run Athena with PostgreSQL 16 via Docker Compose:

```bash
docker compose up --build
```

This starts:

- `postgres` on `localhost:5432`
- `dex` (local OIDC provider mimic) on `localhost:5556`
- `athena` on `localhost:8080`

The main public endpoints are:

- `GET http://localhost:8080/_status/check`
- `GET http://localhost:8080/_status/ping`

Compose currently prepares Athena with a PostgreSQL 16 instance, local Dex for OIDC, and the required auth environment variables.

Compose also includes a one-shot `prepare` service that runs Athena migrations before the app starts, mirroring the Portal pattern of bootstrapping the database before application health checks.

Container runtime modes are selected with `APP_ATHENA_RUN_MODE`:

- `production`: builds Athena and starts the server.
- `dev`: runs the watcher for live development.
- `test`: runs `npm run test`.

## E2E testing

Athena uses Playwright E2E tests with a local wrapper in [app/testing/playwright](./app/testing/playwright), mirroring the lightweight shared-fixture pattern used in Portal.

See [docs/testing-standards.md](./docs/testing-standards.md) for the canonical test strategy and coverage expectations.

Run the E2E suite from [app](./app):

```bash
cd app
npm run test
```

This uses [app/playwright.config.ts](./app/playwright.config.ts), starts the local Compose stack in global setup, runs the migration `prepare` service, waits for Athena to become healthy, and then executes co-located `*.spec.ts` tests under [app](./app).

## Default runtime configuration

Athena reads configuration from environment variables with the prefixes `APP_ATHENA`, `APP`, and `ATHENA`.

Useful defaults in the current bootstrap:

- Host: `127.0.0.1`
- Port: `8080`
- OIDC callback URL: `http://athenabe.localhost/authentication/callback`
- Local OIDC discovery URL: `http://dex.localhost/dex/.well-known/openid-configuration`
- Session max age: `86400000` (24 hours)

Authentication-related runtime variables:

- `APP_ATHENA_OIDC_DISCOVERY_URL`
- `APP_ATHENA_OIDC_CLIENT_ID`
- `APP_ATHENA_OIDC_CLIENT_SECRET`
- `APP_ATHENA_OAUTH_CALLBACK_URL`
- `APP_ATHENA_SECRET_KEY`
- `APP_ATHENA_SESSION_MAX_AGE`
- `APP_ATHENA_ALLOWED_ORIGINS`
- `APP_ATHENA_FRONTEND_BASE_URL`

`APP_ATHENA_OIDC_CLIENT_SECRET` and `APP_ATHENA_SECRET_KEY` are required and must be explicitly set. Do not rely on development sample values outside local development.

Database runtime variables:

- `APP_ATHENA_POSTGRESQL_DB_CONNECT_STRING`

`APP_ATHENA_POSTGRESQL_DB_CONNECT_STRING` is required and is the only database connection string used by Athena.

Frontend API routing variable:

- `VITE_API_BASE_URL`

Frontend behavior:

- `APP_ATHENA_FRONTEND_BASE_URL` is the frontend origin/base URL used by the backend for auth redirects when no safe `returnTo` is available.
- `VITE_API_BASE_URL` is a build-time variable consumed directly by Vite.
- `VITE_API_BASE_URL` is required and must be non-empty.
- The UI always calls backend APIs using this explicit base URL (for example `https://api.athena.example.com`).

Deployment note:

- See [docs/deployment.md](./docs/deployment.md) for deployment guidance focused on `VITE_API_BASE_URL`.

Backend CORS behavior:

- Athena registers CORS middleware with `credentials: true` and an origin allowlist from `APP_ATHENA_ALLOWED_ORIGINS`.
- `APP_ATHENA_ALLOWED_ORIGINS` is required and must be set to your frontend host list, for example `https://athena.example.com`.
- `APP_ATHENA_FRONTEND_BASE_URL` is required and must be set to the frontend base URL users should return to after authentication.

For local development with Compose, set these in `.env` and keep defaults/example values in `.example.env`.

For local Compose, PostgreSQL runs as:

- Version: `16`
- Database: `athena`
- User: `athena`
- Password: `athena`

## Packaging notes

The repository already includes a first-cut rock definition and charm sources, but some packaging files were copied from other services and are still being renamed and simplified. Treat the packaging layer as in-progress while Athena bootstrap work continues.
