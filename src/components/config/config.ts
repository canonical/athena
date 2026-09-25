import { backendConfig } from "@components/config/backend-config.js";
import { createEnvAccessor } from "@components/config/env-accessor.js";
import { ensurePG } from "@components/postgres/postgres.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`], allowEmpty: true });
const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`], allowEmpty: false });

const port = requiredEnv.getNumber(`PORT`);
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
    nodeEnv,
  },
  logging: {
    ...backendConfig.logging,
  },
  cors: {
    allowedOrigins: requiredEnv.getList(`ALLOWED_ORIGINS`, `,`),
  },
  frontend: {
    baseUrl: normalizeBaseUrl(requiredEnv.getEnv(`FRONTEND_BASE_URL`)),
  },
  authentication: {
    oidc: {
      oauthCallbackUrl: requiredEnv.getEnv(`OAUTH_CALLBACK_URL`),
      discoveryUrl: env.getEnv(`OIDC_DISCOVERY_URL`, `http://dex.localhost/dex/.well-known/openid-configuration`),
      clientId: env.getEnv(`OIDC_CLIENT_ID`, `athena`),
      clientSecret: requiredEnv.getEnv(`OIDC_CLIENT_SECRET`),
    },
    session: {
      secret: requiredEnv.getEnv(`SECRET_KEY`),
      maxAgeMs: env.getNumber(`SESSION_MAX_AGE`, 24 * 60 * 60 * 1000),
    },
    credentials: {
      encryptionKey: requiredEnv.getEnv(`CREDENTIAL_ENCRYPTION_KEY`),
    },
  },
  database: {
    ...backendConfig.database,
  },
};

Object.freeze(config);

ensurePG({
  applicationName: `athena-web/${backendConfig.runtime.instanceId}`,
  connectionString: config.database.connectionString,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
  idleTimeoutMillis: config.database.poolIdleTimeoutMs,
  max: config.database.poolMax,
});

export type AppConfig = typeof config;
