-- Event log for Athena loop orchestration
CREATE TABLE IF NOT EXISTS "event" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "sourceType" TEXT NOT NULL,
  "sourceRef" TEXT,
  "status" TEXT NOT NULL,
  "assignee" TEXT,
  "workItemUrl" TEXT,
  "topLevelWorkItemUrl" TEXT,
  "requestedOutcome" TEXT,
  "emittedByPersona" TEXT,
  "blocker" TEXT,
  "approvals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "emittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxEventLoop" ON "event"("loop");
CREATE INDEX IF NOT EXISTS "idxEventStatus" ON "event"("status");
CREATE INDEX IF NOT EXISTS "idxEventAssignee" ON "event"("assignee");
CREATE INDEX IF NOT EXISTS "idxEventWorkItemUrl" ON "event"("workItemUrl");
CREATE INDEX IF NOT EXISTS "idxEventTopLevelWorkItemUrl" ON "event"("topLevelWorkItemUrl");
CREATE INDEX IF NOT EXISTS "idxEventSourceType" ON "event"("sourceType");
CREATE INDEX IF NOT EXISTS "idxEventEmittedAt" ON "event"("emittedAt" DESC);

SELECT ensureUpdatedAtTrigger('event');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'event', :'APP_ROLE_NAME')
\gexec
