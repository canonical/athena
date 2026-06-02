import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnvAccessor } from "@portal/utilities/config";
import { TRACEPARENT_HEADER_NAME } from "@portal/utilities/logging/trace";
import { normalizeFqdn, normalizeRoot } from "@portal/utilities/normalizer";
import { ensurePG } from "@portal/utilities/postgres";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });
const processEnv = createEnvAccessor({ allowEmpty: true });

const port = env.getNumber(`PORT`, 4141);
const host = env.getEnv(`HOST`, `127.0.0.1`);
const fqdn = normalizeFqdn(env.getEnv(`FQDN`, `http://localhost:${port}`));
const root = normalizeRoot(env.getEnv(`ROOT`, `/`));
const htmlBase = root === `/` ? `/` : `${root}/`;
const telemetryExporterHeaders = env.parseJson<Record<string, string>>(`LOG_TELEMETRY_EXPORTER_HEADERS`, {});
const homeDirectory = processEnv.getEnv(`HOME`, env.getEnv(`HOME_DIRECTORY`, `/tmp/athena`));
const ollamaBinaryPath = env.getEnv(`OLLAMA_BINARY_PATH`, ``) || null;
const user = processEnv.getEnv(`USER`, ``) || null;
const hostname = processEnv.getEnv(`HOSTNAME`, `unknown`);
const athenaModelMemoryBudgetRatio = env.getEnv(`MODEL_MEMORY_BUDGET_RATIO`, ``) || null;
const cloudflaredTunnelFqdn = env.getEnv(`CLOUDFLARED_TUNNEL_FQDN`, ``) || null;
const bootstrapModel = env.getEnv(`BOOTSTRAP_MODEL`, `nemotron-3-nano:4b`);
const configDirectoryPath = dirname(fileURLToPath(import.meta.url));
const personaDirectoryCandidates = [join(process.cwd(), `src`, `personas`), join(configDirectoryPath, `..`, `..`, `personas`)];
const personaDirectoryPath = personaDirectoryCandidates.find((candidatePath) => existsSync(candidatePath));

if (!personaDirectoryPath) {
  throw new Error(`Unable to locate Athena persona directory. Checked: ${personaDirectoryCandidates.join(`, `)}`);
}

const personas = Object.freeze(
  Object.fromEntries(
    readdirSync(personaDirectoryPath)
      .filter((fileName) => fileName.endsWith(`.persona.md`))
      .sort((left, right) => left.localeCompare(right))
      .map((fileName) => [fileName, readFileSync(join(personaDirectoryPath, fileName), `utf8`)]),
  ),
);

export const config = {
  app: {
    port,
    host,
    fqdn,
    root,
    htmlBase,
  },
  logging: {
    traceHeaderName: TRACEPARENT_HEADER_NAME,
    serviceName: env.getEnv(`LOG_SERVICE_NAME`, `athena`),
    telemetry: {
      enabled: env.getBoolean(`LOG_TELEMETRY_ENABLED`, false),
      exporterEndpoint: env.getEnv(`LOG_TELEMETRY_EXPORTER_ENDPOINT`, ``) || undefined,
      exporterHeaders: Object.keys(telemetryExporterHeaders).length > 0 ? telemetryExporterHeaders : undefined,
    },
  },
  database: {
    connectionString: env.getEnv(`POSTGRESQL_DB_CONNECT_STRING`),
    pool: {
      max: env.getNumber(`PG_POOL_MAX`, 1),
      idleTimeoutMs: env.getNumber(`PG_POOL_IDLE_TIMEOUT_MS`, 60000),
    },
  },
  runtime: {
    user,
    hostname,
    homeDirectory,
    ollamaBinaryPath,
  },
  environment: {
    athenaModelMemoryBudgetRatio,
    cloudflaredTunnelFqdn,
  },
  ollama: {
    bootstrapModel,
  },
  personas,
};

Object.freeze(config);

ensurePG({ connectionString: config.database.connectionString, max: config.database.pool.max, idleTimeoutMillis: config.database.pool.idleTimeoutMs });

export type AppConfig = typeof config;
