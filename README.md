# Athena

Athena is a full-stack multi-agent orchestration service. This repository contains the Express runtime, React SPA, PostgreSQL migrations, Playwright E2E tests, and deployment packaging for the current Athena application.

Athena is deterministic application code. Personas, providers, runners, repositories, and workgraphs are configured inside Athena loops; LLM behavior comes from configured external systems rather than from hidden logic in the Athena server itself.

Start here: [quick-start.md](./docs/quick-start.md)

## Current status

- Service name: Athena
- Version: `1.2.0`
- Runtime: Node.js + TypeScript backend with a React 19 frontend
- Persistence: PostgreSQL, with schema under [migrations/pg](./migrations/pg)
- Authentication: OIDC-backed session auth with Passport and `cookie-session`
- Current external integration types:
  - Providers: `openrouter`
  - Repositories: `github`
  - Workgraphs: `jira`
  - Runners: `github-copilot-cloud`, `juju-vm`
- Packaging:
  - Rockcraft in [rockcraft.yaml](./rockcraft.yaml)
  - Juju charm in [charm](./charm)

## Repository layout

- [src](./src): application source.
  - [src/server.ts](./src/server.ts): Express entrypoint.
  - [src/components](./src/components): co-located frontend/backend feature modules.
- [testing](./testing): Playwright setup, coverage helpers, and test data.
- [migrations](./migrations): PostgreSQL migrations and seed files.
- [docs](./docs): repository standards and product concepts.
- [docs/specs/index.md](./docs/specs/index.md): local specification, implementation-plan, and persona index.
- [scripts](./scripts): local/dev packaging helpers, Dex config templates, and release helpers.
- [rockcraft.yaml](./rockcraft.yaml): rock definition.
- [charm](./charm): Juju charm sources and charm tests.

## Coding standards

Athena uses a co-located, flat component structure in [src/components](./src/components): frontend, backend, schemas, queries, and service files for the same feature live side-by-side in the same folder.

See [docs/coding-standards.md](./docs/coding-standards.md) for the canonical rules, including file move conventions.

## Task model

Task behavior is implemented in [src/components/task](./src/components/task).

- Task records are defined in [src/components/task/task.schema.ts](./src/components/task/task.schema.ts).
- A task belongs to a loop and tracks:
  - current persona, provider, model, and objective
  - status (`queued`, `wip`, `completed`)
  - optional assigned workgraph item
  - active queue items and archived queue history
- Queue items are message entries with approval states (`pending`, `awaiting-approval`, `approved`, `completed`).
- The server starts a background task processor from [src/server.ts](./src/server.ts), and task iteration logic lives in [src/components/task/task.processor.ts](./src/components/task/task.processor.ts) and [src/components/task/task.iteratorPrimary.ts](./src/components/task/task.iteratorPrimary.ts).
- The loop-level tool catalog is defined in [src/components/tool/tool.catalog.ts](./src/components/tool/tool.catalog.ts); some tools require explicit user approval before completion.
- Task iteration notes are tracked in [docs/task-iteration.md](./docs/task-iteration.md).

## PR publishing and updating standards

Athena requires validation before creating and updating pull requests.

See [docs/pr-publishing-updating-standards.md](./docs/pr-publishing-updating-standards.md) for the canonical requirements.

## Development model

Athena development is local-spec-first.

- Specification, reference, and description artifacts are maintained in [docs/specs/index.md](./docs/specs/index.md).
- Before implementation, agents gather scope, acceptance criteria, and dependency context from local specs.
- Keep local specs synchronized with implementation and behavioral changes.
- Personas are defined under [docs/specs/personas](./docs/specs/personas) and constrained by [docs/specs/definitions/persona.md](./docs/specs/definitions/persona.md).
- Jira is an optional external task source and only participates when a loop is configured to ingest it.

See [AGENTS.md](./AGENTS.md) for the repository’s agent workflow guide.

## What the app does today

The current application serves an authenticated SPA plus a JSON API.

- The frontend is mounted from the Express server and uses TanStack Router and TanStack Query.
- All SPA routes except `/authentication` and `/authentication/sign-out` are guarded by authentication checks.
- The root route (`/`) opens the loop list.
- Loop views expose tabs for tasks, details, tools, members, personas, providers, runners, workgraphs, and repositories.
- Global views also exist for:
  - workgraph and repository connections under `/connection/...`
  - persona management under `/persona/...`
  - provider management under `/provider/...`
  - runner management under `/runner/...`
  - workgraph management under `/workgraph/...`
- Loop readiness is evaluated before task processing. A loop is blocked if it does not have the required routing persona, execution persona, provider/model configuration, runner, and workgraph assignments.
- The server also starts background processors for tasks and inbound webhook items.
- Athena provides PostgreSQL-backed durable-job infrastructure through `pg-boss`. The
  HTTP process produces registered jobs and a separate worker process consumes them.
- A loop admin can enable private history memory with an embedding-capable provider.
  Athena backfills live and archived task history in the worker, incrementally indexes
  later history, and exposes the loop-scoped `own-memory-lookup` tool while memory is
  enabled.

## Local development

The application code lives at repository root.

Install dependencies:

```bash
npm install
```

Run the frontend build watcher and backend watcher together:

```bash
npm run watch
```

- `watch:fe` builds the Vite frontend into `dist/public` in watch mode.
- `watch:be` rebuilds the backend and starts `npm start` through Nodemon.

Run static checks:

```bash
npm run check
```

Build the service:

```bash
npm run build
```

Start the built service:

```bash
npm run start
```

Run Athena with the local Compose stack:

```bash
docker compose up --build
```

The Compose stack includes:

- `traefik` on `localhost:80`
- `postgres` on `localhost:5432`
- `prepare`, Athena's one-shot SQL migration runner
- `pg-boss-prepare`, the one-shot pg-boss schema migration runner
- `athena-worker`, the durable background-job consumer
- `dex` on `localhost:5556`, also reachable through `http://athena.localhost/dex`
- `athena` on `http://athena.localhost`

Optional public tunnel:

```bash
docker compose up -d cloudflared
docker compose logs -f cloudflared
```

This requires `CLOUDFLARED_TUNNEL_TOKEN` in your local environment.

## E2E testing

Athena uses Playwright E2E tests with co-located `*.spec.ts` files under [src](./src).

See [docs/testing-standards.md](./docs/testing-standards.md) for the canonical test strategy and coverage expectations.

Run the default suite:

```bash
npm test
```

Useful variants:

```bash
npm run test:coverage
npm run test:ci
npm run test:ui
```

What the Playwright setup does:

- uses [playwright.config.ts](./playwright.config.ts)
- starts the Compose stack in [testing/playwright-global-setup.ts](./testing/playwright-global-setup.ts)
- waits for Athena, Dex discovery, and the frontend shell to become reachable
- runs co-located specs from these current feature areas:
  - authentication
  - loop
  - persona
  - provider
  - runner
  - shell
  - status

Coverage-enabled runs collect frontend and backend coverage data; `npm run test:ci` then generates merged reports under [testing/results/coverage](./testing/results/coverage).

## Default runtime configuration

Athena reads backend runtime configuration from environment variables with the prefixes `APP_ATHENA`, `APP`, and `ATHENA`, in that order.

### Required backend variables

- `APP_ATHENA_PORT`
- `APP_ATHENA_ALLOWED_ORIGINS`
- `APP_ATHENA_FRONTEND_BASE_URL`
- `APP_ATHENA_OIDC_CLIENT_SECRET`
- `APP_ATHENA_SECRET_KEY`
- `APP_ATHENA_CREDENTIAL_ENCRYPTION_KEY`
- `APP_ATHENA_POSTGRESQL_DB_CONNECT_STRING`

### Optional backend variables and current defaults

- `APP_ATHENA_NODE_ENV=development`
- `APP_ATHENA_LOG_TRACE_HEADER_NAME=traceparent`
- `APP_ATHENA_LOG_SERVICE_NAME=athena-service`
- `APP_ATHENA_LOG_LEVEL=info`
- `APP_ATHENA_LOG_ENABLED=true`
- `APP_ATHENA_OAUTH_CALLBACK_URL=http://athena.localhost/api/authentication/callback`
- `APP_ATHENA_OIDC_DISCOVERY_URL=http://dex.localhost/dex/.well-known/openid-configuration`
- `APP_ATHENA_OIDC_CLIENT_ID=athena`
- `APP_ATHENA_SESSION_MAX_AGE=86400000`
- `APP_ATHENA_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS=30000`
- `APP_ATHENA_BACKGROUND_JOB_RETRY_LIMIT=3`
- `APP_ATHENA_BACKGROUND_JOB_RETRY_DELAY_SECONDS=5`

### Frontend build-time variable

- `VITE_API_BASE_URL` is required and must be non-empty.
- In local Compose, the default is `/api`.
- For split frontend/backend deployments, see [docs/deployment.md](./docs/deployment.md).

### Local Compose variables

The checked-in sample is [.example.env](./.example.env). It includes:

- `POSTGRES_PASSWORD`
- `APP_ATHENA_POSTGRESQL_DB_CONNECT_STRING`
- `APP_ATHENA_BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS`
- `APP_ATHENA_BACKGROUND_JOB_RETRY_LIMIT`
- `APP_ATHENA_BACKGROUND_JOB_RETRY_DELAY_SECONDS`
- `APP_ATHENA_PORT`
- `APP_ATHENA_DEV_MODE`
- `APP_ATHENA_OAUTH_CALLBACK_URL`
- `APP_ATHENA_DEX_EXTRA_REDIRECT_URIS`
- `APP_ATHENA_OIDC_DISCOVERY_URL`
- `APP_ATHENA_OIDC_CLIENT_ID`
- `APP_ATHENA_OIDC_CLIENT_SECRET`
- `APP_ATHENA_SECRET_KEY`
- `APP_ATHENA_CREDENTIAL_ENCRYPTION_KEY`
- `APP_ATHENA_SESSION_MAX_AGE`
- `APP_ATHENA_ALLOWED_ORIGINS`
- `APP_ATHENA_FRONTEND_BASE_URL`
- `VITE_API_BASE_URL`
- `CLOUDFLARED_TUNNEL_TOKEN`

## Packaging notes

- [rockcraft.yaml](./rockcraft.yaml) builds the Node application and stages the built backend, frontend, dependencies, and migrations into the rock.
- [scripts/stage-app.sh](./scripts/stage-app.sh) assembles an ephemeral `app/` directory for rock builds without changing the tracked repository layout.
- [charm](./charm) contains a Python-based `expressjs-framework` charm that depends on PostgreSQL and expects Juju secrets for OIDC and credential encryption.
- Manual charm deployment guidance lives in [charm/tests/manual/README.md](./charm/tests/manual/README.md).

## Related documentation

- [docs/workgraph.md](./docs/workgraph.md): workgraph concept and boundaries
- [docs/testing-standards.md](./docs/testing-standards.md): E2E-only testing policy
- [docs/deployment.md](./docs/deployment.md): `VITE_API_BASE_URL` deployment note
- [docs/database-standards.md](./docs/database-standards.md): database conventions
- [docs/design-standards.md](./docs/design-standards.md): UI and UX standards
- [docs/documentation-standards.md](./docs/documentation-standards.md): documentation conventions
- [docs/specs/index.md](./docs/specs/index.md): specs, implementation plans, and personas
