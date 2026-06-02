# Athena

Athena is a multi-agent orchestration service. This repository is the bootstrap workspace for the service runtime, packaging, and deployment artifacts.

At the moment, the implementation is still early-stage. The application already exposes a small HTTP surface for health, environment inspection, and routing scaffolding, while the repository also carries the first rock and charm packaging files.

## Current status

- Service name: Athena
- Version: 0.0.1
- Runtime: Node.js and TypeScript in [app](./app)
- Packaging: Rockcraft in [rockcraft.yaml](./rockcraft.yaml)
- Operator packaging: Juju charm in [charm](./charm)
- Current API surface: `/health`, `/environment`, `/route`

## Repository layout

- [app](./app): Express-based Athena service, personas, definitions, and database migrations for the application runtime.
- [charm](./charm): Juju charm sources for deploying Athena.
- [migrations](./migrations): Repository-level PostgreSQL schema and seed files.
- [rockcraft.yaml](./rockcraft.yaml): Rock packaging definition for Athena.

## What the app does today

The current service starts an Express server and exposes a few bootstrap endpoints:

- `GET /health`: returns a basic service health response.
- `GET /environment`: returns a runtime environment snapshot.
- `POST /route`: placeholder route-decision endpoint.

The service also loads Athena personas from [app/src/personas](./app/src/personas) during startup and runs bootstrap logic before handling normal traffic.

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

## Default runtime configuration

Athena reads configuration from environment variables with the prefixes `APP_ATHENA`, `APP`, and `ATHENA`.

Useful defaults in the current bootstrap:

- Host: `127.0.0.1`
- Port: `4141`
- Root path: `/`

The service expects a PostgreSQL connection string to be available through `POSTGRESQL_DB_CONNECT_STRING`.

## Packaging notes

The repository already includes a first-cut rock definition and charm sources, but some packaging files were copied from other services and are still being renamed and simplified. Treat the packaging layer as in-progress while Athena bootstrap work continues.
