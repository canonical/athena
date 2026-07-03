CREATE TABLE IF NOT EXISTS "provider" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "providerType" TEXT NOT NULL CHECK ("providerType" IN ('openrouter')),
  "baseUrl" TEXT NOT NULL CHECK ("baseUrl" ~* '^https://'),
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

CREATE INDEX IF NOT EXISTS "idxProviderOwner" ON "provider"("owner");
CREATE INDEX IF NOT EXISTS "idxProviderProviderType" ON "provider"("providerType");

SELECT ensureUpdatedAtTrigger('provider');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'provider', :'APP_ROLE_NAME')
\gexec
