CREATE TABLE IF NOT EXISTS "providerEmbedder" (
  "provider" UUID PRIMARY KEY REFERENCES "provider"("id") ON DELETE CASCADE,
  "model" TEXT NOT NULL CHECK (LENGTH(BTRIM("model")) > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT ensureUpdatedAtTrigger('providerEmbedder');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'providerEmbedder', :'APP_ROLE_NAME')
\gexec
