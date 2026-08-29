CREATE TABLE IF NOT EXISTS "provider" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "providerType" TEXT NOT NULL CHECK ("providerType" IN ('openrouter')),
  "baseUrl" TEXT NOT NULL,
  "defaultModel" TEXT,
  "enabledModels" TEXT[],
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "displayName"),
  CONSTRAINT "providerBaseUrlScheme" CHECK ("baseUrl" ~* '^https?://')
);

-- Replace the HTTPS-only constraint created by earlier versions of this migration.
ALTER TABLE "provider" DROP CONSTRAINT IF EXISTS "provider_baseUrl_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"provider"'::regclass AND conname = 'providerBaseUrlScheme'
  ) THEN
    ALTER TABLE "provider"
      ADD CONSTRAINT "providerBaseUrlScheme" CHECK ("baseUrl" ~* '^https?://');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idxProviderOwner" ON "provider"("owner");
CREATE INDEX IF NOT EXISTS "idxProviderProviderType" ON "provider"("providerType");

SELECT ensureUpdatedAtTrigger('provider');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'provider', :'APP_ROLE_NAME')
\gexec
