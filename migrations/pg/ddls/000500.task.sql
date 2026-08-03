-- Task log for Athena loop orchestration
CREATE TABLE IF NOT EXISTS "task" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "phase" TEXT NOT NULL DEFAULT 'routing',
  "sourceType" TEXT NOT NULL,
  "sourceRef" TEXT,
  "status" TEXT NOT NULL,
  "assignee" TEXT,
  "selectedPersona" UUID REFERENCES "persona"("id") ON DELETE SET NULL,
  "targetType" TEXT,
  "targetId" UUID,
  "routeReasonCode" TEXT,
  "routeReasonText" TEXT,
  -- Work definition (was requestedOutcome + task.objective)
  "description" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'other',
  "ownerMode" TEXT NOT NULL DEFAULT 'mixed',
  "successCriteria" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "externalRefs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Execution state (was task.currentContext)
  "context" TEXT NOT NULL DEFAULT '',
  -- Routing metadata (was task.routing JSONB sub-field)
  "routing" JSONB NOT NULL DEFAULT '{
    "routeAttempts": 0,
    "lastRoutedAt": null,
    "lastRoutedByPersona": null,
    "lastRouteReasonCode": null
  }'::jsonb,
  "emittedByPersona" TEXT,
  "blocker" TEXT,
  "approvals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "payload" JSONB NOT NULL DEFAULT '{"timeline": []}'::jsonb,
  "claimToken" UUID,
  "claimOwner" TEXT,
  "pingedAt" TIMESTAMPTZ,
  "processingSourceStatus" TEXT,
  "claimAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "autonomyIterationCount" INTEGER NOT NULL DEFAULT 0,
  "autonomyMaxIterations" INTEGER NOT NULL DEFAULT 5,
  "emittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxTaskLoop" ON "task"("loop");
CREATE INDEX IF NOT EXISTS "idxTaskPhaseStatus" ON "task"("phase", "status");
CREATE INDEX IF NOT EXISTS "idxTaskStatus" ON "task"("status");
CREATE INDEX IF NOT EXISTS "idxTaskAssignee" ON "task"("assignee");
CREATE INDEX IF NOT EXISTS "idxTaskSelectedPersona" ON "task"("selectedPersona");
CREATE INDEX IF NOT EXISTS "idxTaskRouteReasonCode" ON "task"("routeReasonCode");
CREATE INDEX IF NOT EXISTS "idxTaskSourceType" ON "task"("sourceType");
CREATE INDEX IF NOT EXISTS "idxTaskTargetType" ON "task"("targetType");
CREATE INDEX IF NOT EXISTS "idxTaskTargetId" ON "task"("targetId");
CREATE INDEX IF NOT EXISTS "idxTaskClaimToken" ON "task"("claimToken");
CREATE INDEX IF NOT EXISTS "idxTaskStatusPingedAt" ON "task"("status", "pingedAt" ASC);
CREATE INDEX IF NOT EXISTS "idxTaskEmittedAt" ON "task"("emittedAt" DESC);
CREATE INDEX IF NOT EXISTS "idxTaskStatusUpdatedAt" ON "task"("status", "updatedAt" ASC);

SELECT ensureUpdatedAtTrigger('task');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'task', :'APP_ROLE_NAME')
\gexec
