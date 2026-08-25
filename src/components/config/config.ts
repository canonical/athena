import { createEnvAccessor } from "@components/config/env-accessor.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });
const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: false });

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
    traceHeaderName: env.getEnv(`LOG_TRACE_HEADER_NAME`, `traceparent`),
    serviceName: env.getEnv(`LOG_SERVICE_NAME`, `athena-service`),
    level: env.getEnv(`LOG_LEVEL`, `info`),
    enabled: env.getBoolean(`LOG_ENABLED`, true),
  },
  cors: {
    allowedOrigins: requiredEnv.getList(`ALLOWED_ORIGINS`, `,`),
  },
  frontend: {
    baseUrl: normalizeBaseUrl(requiredEnv.getEnv(`FRONTEND_BASE_URL`)),
  },
  authentication: {
    oidc: {
      oauthCallbackUrl: env.getEnv(`OAUTH_CALLBACK_URL`, `http://athena.localhost/api/authentication/callback`),
      discoveryUrl: env.getEnv(`OIDC_DISCOVERY_URL`, `http://dex.localhost/dex/.well-known/openid-configuration`),
      clientId: env.getEnv(`OIDC_CLIENT_ID`, `athena`),
      clientSecret: requiredEnv.getEnv(`OIDC_CLIENT_SECRET`),
    },
    session: {
      secret: requiredEnv.getEnv(`SECRET_KEY`),
      maxAgeMs: env.getNumber(`SESSION_MAX_AGE`, 24 * 60 * 60 * 1000),
    },
  },
};

Object.freeze(config);

export type AppConfig = typeof config;
