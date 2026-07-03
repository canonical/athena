CREATE TABLE IF NOT EXISTS "providerDefinition" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "providerType" TEXT NOT NULL CHECK ("providerType" IN ('openrouter')),
  "baseUrl" TEXT NOT NULL CHECK (LOWER("baseUrl") LIKE 'https://%'),
  "model" TEXT,
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "displayName")
);

CREATE INDEX IF NOT EXISTS "idxProviderDefinitionOwner" ON "providerDefinition"("owner");
CREATE INDEX IF NOT EXISTS "idxProviderDefinitionProviderType" ON "providerDefinition"("providerType");

SELECT ensureUpdatedAtTrigger('providerDefinition');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'providerDefinition', :'APP_ROLE_NAME')
\gexec
