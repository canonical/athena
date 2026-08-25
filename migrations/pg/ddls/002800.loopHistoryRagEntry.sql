CREATE TABLE IF NOT EXISTS "loopHistoryRagEntry" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loopHistoryRag"("loop") ON DELETE CASCADE,
  "task" UUID NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
  "queueItem" UUID NOT NULL,
  "source" TEXT NOT NULL CHECK ("source" IN ('queue', 'archive')),
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "text" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "embedding" vector NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("loop", "task", "queueItem")
);

CREATE INDEX IF NOT EXISTS "idxLoopHistoryRagEntryTask" ON "loopHistoryRagEntry"("task");

SELECT ensureUpdatedAtTrigger('loopHistoryRagEntry');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopHistoryRagEntry', :'APP_ROLE_NAME')
\gexec
