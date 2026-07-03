CREATE TABLE IF NOT EXISTS "loopProvider" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "provider" UUID NOT NULL REFERENCES "provider"("id") ON DELETE CASCADE,
  "priority" INTEGER NOT NULL CHECK ("priority" >= 1),
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "timeoutMs" INTEGER NOT NULL DEFAULT 120000 CHECK ("timeoutMs" BETWEEN 1000 AND 600000),
  "maxRetries" INTEGER NOT NULL DEFAULT 1 CHECK ("maxRetries" BETWEEN 0 AND 10),
  "priorityOverride" INTEGER CHECK ("priorityOverride" >= 1),
  "assignmentOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "selectionWeight" NUMERIC(10, 4) NOT NULL DEFAULT 1 CHECK ("selectionWeight" > 0),
  "remainingCreditPercentage" NUMERIC(8, 4) CHECK ("remainingCreditPercentage" BETWEEN 0 AND 100),
  "remainingCreditValue" NUMERIC(20, 8) CHECK ("remainingCreditValue" >= 0),
  "lastUsedAt" TIMESTAMPTZ,
  "lastFailedAt" TIMESTAMPTZ,
  "cooldownUntil" TIMESTAMPTZ,
  "healthStatus" TEXT NOT NULL DEFAULT 'unknown' CHECK ("healthStatus" IN ('unknown', 'healthy', 'failing')),
  "failureCount" INTEGER NOT NULL DEFAULT 0 CHECK ("failureCount" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "provider")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idxLoopProviderLoopPriority" ON "loopProvider"("loop", "priority");
CREATE UNIQUE INDEX IF NOT EXISTS "idxLoopProviderLoopPriorityOverride" ON "loopProvider"("loop", "priorityOverride") WHERE "priorityOverride" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idxLoopProviderProvider" ON "loopProvider"("provider");

SELECT ensureUpdatedAtTrigger('loopProvider');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopProvider', :'APP_ROLE_NAME')
\gexec
