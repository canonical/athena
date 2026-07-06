# Athena

Athena is a multi-agent orchestration service. This repository is the bootstrap workspace for the service runtime, packaging, and deployment artifacts.

Athena itself is fully deterministic code. Agents that integrate with Athena loops handle LLM business and domain-specific reasoning.

At the moment, the implementation is still early-stage. The application now includes a first OIDC-backed session authentication flow alongside bootstrap packaging files.

## Current status

- Service name: Athena
- Version: 0.0.1
- Runtime: Node.js and TypeScript in the repository root
- Packaging: Rockcraft in [rockcraft.yaml](./rockcraft.yaml)
- Operator packaging: Juju charm in [charm](./charm)
- Current API surface: `GET /_status/check`

## Repository layout

- Runtime sources and build configs in repository root (`src`, `testing`, and top-level Node/TypeScript config files)
- [charm](./charm): Juju charm sources for deploying Athena.
- [migrations](./migrations): Repository-level PostgreSQL schema and seed files.
- [docs/specs/index.md](./docs/specs/index.md): Local specification, reference, and persona artifacts index.
- [rockcraft.yaml](./rockcraft.yaml): Rock packaging definition for Athena.

## Coding standards

Athena uses a co-located, flat component structure in [src/components](./src/components): frontend and backend files for the same feature live side-by-side in the same component folder, and component folders contain files only.

See [docs/coding-standards.md](./docs/coding-standards.md) for the canonical rules, including file move conventions.

## PR publishing and updating standards

Athena requires validation before creating and updating pull requests.

See [docs/pr-publishing-updating-standards.md](./docs/pr-publishing-updating-standards.md) for the canonical pull request publishing and update requirements.

## Development model

Athena development is local-spec-first.

- Specification, reference, and description artifacts are maintained in [docs/specs/index.md](./docs/specs/index.md).
- Before implementation, agents gather scope, acceptance criteria, and dependency context from local specs.
- Keep local specs synchronized with implementation and behavioral changes.
- Personas are persisted per loop, with lifecycle constraints defined in [docs/specs/definitions/persona.md](./docs/specs/definitions/persona.md).
- Jira is an optional external event source and only participates when a loop is configured to ingest Jira events.

See [AGENTS.md](./AGENTS.md) for agent workflow guidance.

## What the app does today

The current service starts an Express server with session-based authentication:

- Frontend route:
  - `GET /authentication`: React authentication view that allows sign-in and sign-out via backend auth endpoints.

- Public health endpoints:
  - `GET /_status/check`
  - `GET /_status/ping`
- Public auth endpoints:
  - `GET /api/authentication/login`
  - `GET /api/authentication/callback`
  - `POST /api/authentication/logout`
  - `GET /api/authentication/profile`
- Backend route policy:
  - Non-public backend routes require an authenticated session.
  - Unauthenticated requests return HTTP `401 Unauthorized`.
  - Static assets and SPA fallback are served by the Express backend static router.

## Local development

The application code lives in the repository root.

Install dependencies:

```bash
npm install
```

Run the TypeScript watcher for local development:

```bash
npm run watch
```

Build the service:

```bash
npm run build
```

Start the built service:

```bash
npm run start
```

Run Athena with PostgreSQL 16 via Docker Compose:

```bash
docker compose up --build
```

This starts:

- `postgres` on `localhost:5432`
- `dex` (local OIDC provider mimic) on `localhost:5556`
- `athena` on `athena.localhost` (served through Traefik)

The main public endpoints are:

- `GET http://athena.localhost/_status/check`
- `GET http://athena.localhost/_status/ping`

Compose currently prepares Athena with a PostgreSQL 16 instance, local Dex for OIDC, and the required auth environment variables.

Compose also includes a one-shot `prepare` service that runs Athena migrations before the app starts, mirroring the Portal pattern of bootstrapping the database before application health checks.

Container runtime is controlled by `APP_ATHENA_DEV_MODE`:

- `true`: runs frontend build watch and backend watch mode.
- `false`: builds Athena and starts the server.

## E2E testing

Athena uses Playwright E2E tests with a local wrapper in [testing/playwright](./testing/playwright), mirroring the lightweight shared-fixture pattern used in Portal.

See [docs/testing-standards.md](./docs/testing-standards.md) for the canonical test strategy and coverage expectations.

Run the E2E suite from repository root:

```bash
npm run test
```

This uses [playwright.config.ts](./playwright.config.ts), starts the local Compose stack in global setup, runs the migration `prepare` service, waits for Athena to become healthy, and then executes co-located `*.spec.ts` tests under [src](./src).

## Default runtime configuration

Athena reads configuration from environment variables with the prefixes `APP_ATHENA`, `APP`, and `ATHENA`.

Useful defaults in the current bootstrap:

- OIDC callback URL: `http://athena.localhost/api/authentication/callback`
- Local OIDC discovery URL: `http://dex.localhost/dex/.well-known/openid-configuration`
- Session max age: `86400000` (24 hours)

Authentication-related runtime variables:

- `APP_ATHENA_OIDC_DISCOVERY_URL`
- `APP_ATHENA_OIDC_CLIENT_ID`
- `APP_ATHENA_OIDC_CLIENT_SECRET`
- `APP_ATHENA_OAUTH_CALLBACK_URL`
- `APP_ATHENA_SECRET_KEY`
- `APP_ATHENA_CREDENTIAL_ENCRYPTION_KEY`
- `APP_ATHENA_SESSION_MAX_AGE`
- `APP_ATHENA_ALLOWED_ORIGINS`
- `APP_ATHENA_FRONTEND_BASE_URL`

`APP_ATHENA_OIDC_CLIENT_SECRET`, `APP_ATHENA_SECRET_KEY`, and `APP_ATHENA_CREDENTIAL_ENCRYPTION_KEY` are required and must be explicitly set. Do not rely on development sample values outside local development.

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
