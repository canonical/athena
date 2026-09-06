CREATE TABLE IF NOT EXISTS "ragRecordSource" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('taskQueueItem', 'toolCall', 'runnerCall')),
  "sourceId" UUID NOT NULL,
  "recordKind" TEXT NOT NULL CHECK ("recordKind" IN ('taskMessage', 'toolDecision', 'toolResult', 'runnerResult')),
  "logicalRef" TEXT,
  "text" TEXT NOT NULL CHECK (LENGTH("text") > 0),
  "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contentHash" TEXT NOT NULL,
  "originalByteCount" INTEGER NOT NULL CHECK ("originalByteCount" >= 0),
  "truncated" BOOLEAN NOT NULL DEFAULT FALSE,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("sourceType", "sourceId")
);

CREATE INDEX IF NOT EXISTS "idxRagRecordSourceLoopOccurredAt" ON "ragRecordSource"("loop", "occurredAt", "id");
CREATE INDEX IF NOT EXISTS "idxRagRecordSourceLogicalRef" ON "ragRecordSource"("loop", "logicalRef") WHERE "logicalRef" IS NOT NULL;

SELECT format('GRANT SELECT, INSERT, DELETE ON %I TO %I', 'ragRecordSource', :'APP_ROLE_NAME')
\gexec
