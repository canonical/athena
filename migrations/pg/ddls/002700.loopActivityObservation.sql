CREATE TABLE IF NOT EXISTS "loopActivityObservation" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "ragIndex" UUID NOT NULL REFERENCES "ragIndex"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('taskMessage', 'taskState', 'toolDecision', 'toolResult', 'runnerResult', 'workgraphItem')),
  "sourceRef" TEXT NOT NULL,
  "logicalRef" TEXT,
  "text" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contentHash" TEXT NOT NULL,
  "originalByteCount" INTEGER NOT NULL CHECK ("originalByteCount" >= 0),
  "truncated" BOOLEAN NOT NULL DEFAULT FALSE,
  "projectionStatus" TEXT NOT NULL DEFAULT 'pending' CHECK ("projectionStatus" IN ('pending', 'projected', 'skipped', 'failed')),
  "projectionError" TEXT,
  "observedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("ragIndex", "sourceRef", "observedAt")
);

CREATE INDEX IF NOT EXISTS "idxLoopActivityObservationPending" ON "loopActivityObservation"("ragIndex", "projectionStatus", "observedAt");
CREATE INDEX IF NOT EXISTS "idxLoopActivityObservationLogicalRef" ON "loopActivityObservation"("ragIndex", "logicalRef");

SELECT ensureUpdatedAtTrigger('loopActivityObservation');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopActivityObservation', :'APP_ROLE_NAME')
\gexec