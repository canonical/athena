# Athena local development

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

For the complete first-run walkthrough, see the [quick-start guide](./quick-start.md).

Optional public tunnel:

```bash
docker compose up -d cloudflared
docker compose logs -f cloudflared
```

This requires `CLOUDFLARED_TUNNEL_TOKEN` in your local environment.
