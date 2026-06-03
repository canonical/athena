import { createEnvAccessor } from "@components/config/env-accessor.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });

const port = env.getNumber(`PORT`, 8080);
const host = env.getEnv(`HOST`, `127.0.0.1`);

export const config = {
  app: {
    port,
    host,
  },
};

Object.freeze(config);

export type AppConfig = typeof config;
