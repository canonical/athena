-- Event log and current event state for Athena loop orchestration
CREATE TABLE IF NOT EXISTS "event" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
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

ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "user"("id") ON DELETE CASCADE;

COMMENT ON TABLE "event" IS 'Athena loop events.';
COMMENT ON COLUMN "event"."id" IS 'Event identifier.';
COMMENT ON COLUMN "event"."userId" IS 'User who submitted the loop request.';
COMMENT ON COLUMN "event"."sourceType" IS 'Origin category of the event.';
COMMENT ON COLUMN "event"."sourceRef" IS 'Source-specific identifier.';
COMMENT ON COLUMN "event"."status" IS 'Current event status.';
COMMENT ON COLUMN "event"."assignee" IS 'Current responsible actor.';
COMMENT ON COLUMN "event"."workItemUrl" IS 'Direct work item URL.';
COMMENT ON COLUMN "event"."topLevelWorkItemUrl" IS 'Top-level work item URL.';
COMMENT ON COLUMN "event"."requestedOutcome" IS 'Requested end result.';
COMMENT ON COLUMN "event"."emittedByPersona" IS 'Persona that emitted the event.';
COMMENT ON COLUMN "event"."blocker" IS 'Current blocking reason.';
COMMENT ON COLUMN "event"."approvals" IS 'Approval data for the event.';
COMMENT ON COLUMN "event"."payload" IS 'Additional event details.';
COMMENT ON COLUMN "event"."emittedAt" IS 'When the event was emitted.';
COMMENT ON COLUMN "event"."completedAt" IS 'When the event completed.';
COMMENT ON COLUMN "event"."updatedAt" IS 'Row update time.';

CREATE INDEX IF NOT EXISTS "idxEventStatus" ON "event"("status");
CREATE INDEX IF NOT EXISTS "idxEventUserId" ON "event"("userId");
CREATE INDEX IF NOT EXISTS "idxEventAssignee" ON "event"("assignee");
CREATE INDEX IF NOT EXISTS "idxEventWorkItemUrl" ON "event"("workItemUrl");
CREATE INDEX IF NOT EXISTS "idxEventTopLevelWorkItemUrl" ON "event"("topLevelWorkItemUrl");
CREATE INDEX IF NOT EXISTS "idxEventSourceType" ON "event"("sourceType");
CREATE INDEX IF NOT EXISTS "idxEventEmittedAt" ON "event"("emittedAt" DESC);

SELECT ensureUpdatedAtTrigger('event');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'event', :'APP_ROLE_NAME')
\gexec