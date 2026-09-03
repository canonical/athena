CREATE TABLE IF NOT EXISTS "ragIndex" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('loopActivity')),
  "sourceStrategy" TEXT NOT NULL CHECK ("sourceStrategy" IN ('loopActivity')),
  "sourceRef" TEXT NOT NULL CHECK (LENGTH(BTRIM("sourceRef")) > 0),
  "segmentationStrategy" TEXT NOT NULL CHECK ("segmentationStrategy" IN ('wholeEntry')),
  "provider" UUID NOT NULL REFERENCES "provider"("id"),
  "embeddingModel" TEXT NOT NULL,
  "embeddingDimension" INTEGER CHECK ("embeddingDimension" > 0),
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'disabled' CHECK ("lifecycleStatus" IN ('disabled', 'rebuilding', 'ready', 'failed')),
  "sourceCount" INTEGER NOT NULL DEFAULT 0 CHECK ("sourceCount" >= 0),
  "pendingCount" INTEGER NOT NULL DEFAULT 0 CHECK ("pendingCount" >= 0),
  "projectedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("projectedCount" >= 0),
  "skippedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("skippedCount" >= 0),
  "failedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("failedCount" >= 0),
  "lastError" TEXT,
  "rebuildStartedAt" TIMESTAMPTZ,
  "rebuildCompletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxRagIndexLifecycleStatus" ON "ragIndex"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "idxRagIndexProvider" ON "ragIndex"("provider");
CREATE INDEX IF NOT EXISTS "idxRagIndexKindSourceRef" ON "ragIndex"("kind", "sourceRef");

SELECT ensureUpdatedAtTrigger('ragIndex');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'ragIndex', :'APP_ROLE_NAME')
\gexec