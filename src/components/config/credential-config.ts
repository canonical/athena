import { createEnvAccessor } from "./env-accessor.js";

const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`], allowEmpty: false });

export const credentialConfig = Object.freeze({
  encryptionKey: requiredEnv.getEnv(`CREDENTIAL_ENCRYPTION_KEY`),
});
