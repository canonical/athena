# Athena

Athena is a multi-agent orchestration service. This repository is the bootstrap workspace for the service runtime, packaging, and deployment artifacts.

At the moment, the implementation is still early-stage. The application currently exposes a single status endpoint while the repository carries the first rock and charm packaging files.

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

## What the app does today

The current service starts an Express server and exposes one status endpoint:

- `GET /_status/check`: returns `{"status":"ok","whoami":"athena"}`.

No bootstrap workflow, routing logic, or environment inspection API is exposed at this stage.

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
- `athena` on `localhost:8080`

The application status endpoint is:

- `GET http://localhost:8080/_status/check`

Compose currently prepares Athena with a PostgreSQL 16 instance and provides `POSTGRESQL_DB_CONNECT_STRING`, but database migrations are not run automatically yet.

Container runtime modes are selected with `APP_ATHENA_RUN_MODE`:

- `production`: builds Athena and starts the server.
- `dev`: runs the watcher for live development.
- `test`: runs `npm run test`.

## Default runtime configuration

Athena reads configuration from environment variables with the prefixes `APP_ATHENA`, `APP`, and `ATHENA`.

Useful defaults in the current bootstrap:

- Host: `127.0.0.1`
- Port: `8080`

For local Compose, PostgreSQL runs as:

- Version: `16`
- Database: `athena`
- User: `athena`
- Password: `athena`

## Packaging notes

The repository already includes a first-cut rock definition and charm sources, but some packaging files were copied from other services and are still being renamed and simplified. Treat the packaging layer as in-progress while Athena bootstrap work continues.
