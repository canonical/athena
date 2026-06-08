import { createEnvAccessor } from "@components/config/env-accessor.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });

const port = env.getNumber(`PORT`, 8080);
const host = env.getEnv(`HOST`, `127.0.0.1`);
const nodeEnv = env.getEnv(`NODE_ENV`, `development`);
const defaultAllowedOrigins = [`http://127.0.0.1:5173`, `http://athena.localhost`];

export const config = {
  application: {
    port,
    host,
    nodeEnv,
  },
  cors: {
    allowedOrigins: env.getList(`ALLOWED_ORIGINS`, `,`, defaultAllowedOrigins),
  },
  authentication: {
    oidc: {
      oauthCallbackUrl: env.getEnv(`OAUTH_CALLBACK_URL`, `http://athenabe.localhost/authentication/callback`),
      discoveryUrl: env.getEnv(`OIDC_DISCOVERY_URL`, `http://dex.localhost/dex/.well-known/openid-configuration`),
      clientId: env.getEnv(`OIDC_CLIENT_ID`, `athena`),
      clientSecret: env.getEnv(`OIDC_CLIENT_SECRET`, `super-secret-value`),
    },
    session: {
      secret: env.getEnv(`SECRET_KEY`, `athena-dev-session-secret-change-me`),
      maxAgeMs: env.getNumber(`SESSION_MAX_AGE`, 24 * 60 * 60 * 1000),
    },
  },
};

Object.freeze(config);

export type AppConfig = typeof config;
