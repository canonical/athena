CREATE TABLE IF NOT EXISTS "ragRecordProjection" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "ragIndex" UUID NOT NULL REFERENCES "ragIndex"("id") ON DELETE CASCADE,
  "ragRecordSource" UUID NOT NULL REFERENCES "ragRecordSource"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'projected', 'skipped', 'failed')),
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("ragIndex", "ragRecordSource")
);

CREATE INDEX IF NOT EXISTS "idxRagRecordProjectionStatusRagIndexCreatedAt" ON "ragRecordProjection"("status", "ragIndex", "createdAt", "id");

SELECT ensureUpdatedAtTrigger('ragRecordProjection');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'ragRecordProjection', :'APP_ROLE_NAME')
\gexec
