-- Minimal task table (breaking change)
CREATE TABLE IF NOT EXISTS "task" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "currentPersona" UUID REFERENCES "persona"("id") ON DELETE SET NULL,
  "currentProvider" UUID REFERENCES "provider"("id") ON DELETE SET NULL,
  "currentModel" TEXT,
  "currentObjective" TEXT,
  "queueArchive" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "source" TEXT NOT NULL CHECK ("source" IN ('user', 'workgraphItem')),
  "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'wip', 'completed')) DEFAULT 'queued',
  "processorUnit" UUID,
  "processorPingedAt" TIMESTAMPTZ,
  "workgraphItem" UUID REFERENCES "loopWorkgraphItem"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "queue" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxTaskLoop" ON "task"("loop");
CREATE INDEX IF NOT EXISTS "idxTaskSource" ON "task"("source");
CREATE INDEX IF NOT EXISTS "idxTaskStatus" ON "task"("status");
CREATE INDEX IF NOT EXISTS "idxTaskProcessorUnit" ON "task"("processorUnit");
CREATE INDEX IF NOT EXISTS "idxTaskWorkgraphItem" ON "task"("workgraphItem");
CREATE INDEX IF NOT EXISTS "idxTaskTitle" ON "task"("title");

SELECT ensureUpdatedAtTrigger('task');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'task', :'APP_ROLE_NAME')
\gexec
