CREATE TABLE IF NOT EXISTS "ragEntry" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "ragIndex" UUID NOT NULL REFERENCES "ragIndex"("id") ON DELETE CASCADE,
  "sourceKind" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "logicalRef" TEXT,
  "segmentKey" TEXT NOT NULL,
  "segmentOrdinal" INTEGER NOT NULL CHECK ("segmentOrdinal" >= 0),
  "text" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "embedding" VECTOR,
  "supersededAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("ragIndex", "sourceRef", "occurredAt", "segmentKey")
);

CREATE INDEX IF NOT EXISTS "idxRagEntryLookup" ON "ragEntry"("ragIndex", "supersededAt", "occurredAt");
CREATE INDEX IF NOT EXISTS "idxRagEntryLogicalRef" ON "ragEntry"("ragIndex", "logicalRef") WHERE "supersededAt" IS NULL;

SELECT ensureUpdatedAtTrigger('ragEntry');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'ragEntry', :'APP_ROLE_NAME')
\gexec