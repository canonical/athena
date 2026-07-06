CREATE TABLE IF NOT EXISTS "persona" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "displayName" TEXT NOT NULL,
  "role" TEXT,
  "personality" TEXT NOT NULL,
  "isRouting" BOOLEAN NOT NULL DEFAULT FALSE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "owner" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxPersonaLifecycleStatus" ON "persona"("lifecycleStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "idxPersonaDefaultDisplayName" ON "persona"("displayName") WHERE "isDefault" = TRUE;

SELECT ensureUpdatedAtTrigger('persona');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'persona', :'APP_ROLE_NAME')
\gexec
