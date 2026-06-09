import { createEnvAccessor } from "@components/config/env-accessor.js";
import { ensurePG } from "@components/postgres/postgres.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });
const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: false });

const port = env.getNumber(`PORT`, 8080);
const host = env.getEnv(`HOST`, `127.0.0.1`);
const nodeEnv = env.getEnv(`NODE_ENV`, `development`);
const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, ``) || `/`;
  url.search = ``;
  url.hash = ``;

  return url.pathname === `/` ? url.origin : `${url.origin}${url.pathname}`;
};
export const config = {
  application: {
    port,
    host,
    nodeEnv,
  },
  cors: {
    allowedOrigins: requiredEnv.getList(`ALLOWED_ORIGINS`, `,`),
  },
  frontend: {
    baseUrl: normalizeBaseUrl(requiredEnv.getEnv(`FRONTEND_BASE_URL`)),
  },
  authentication: {
    oidc: {
      oauthCallbackUrl: env.getEnv(`OAUTH_CALLBACK_URL`, `http://athenabe.localhost/authentication/callback`),
      discoveryUrl: env.getEnv(`OIDC_DISCOVERY_URL`, `http://dex.localhost/dex/.well-known/openid-configuration`),
      clientId: env.getEnv(`OIDC_CLIENT_ID`, `athena`),
      clientSecret: requiredEnv.getEnv(`OIDC_CLIENT_SECRET`),
    },
    session: {
      secret: requiredEnv.getEnv(`SECRET_KEY`),
      maxAgeMs: env.getNumber(`SESSION_MAX_AGE`, 24 * 60 * 60 * 1000),
    },
  },
  database: {
    connectionString: requiredEnv.getEnv(`POSTGRESQL_DB_CONNECT_STRING`),
  },
};

Object.freeze(config);

ensurePG({ connectionString: config.database.connectionString });

export type AppConfig = typeof config;
