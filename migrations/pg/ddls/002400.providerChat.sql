CREATE TABLE IF NOT EXISTS "providerChat" (
  "provider" UUID PRIMARY KEY REFERENCES "provider"("id") ON DELETE CASCADE,
  "defaultModel" TEXT,
  "enabledModels" TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT ensureUpdatedAtTrigger('providerChat');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'providerChat', :'APP_ROLE_NAME')
\gexec
