CREATE TABLE IF NOT EXISTS "loop" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "iterationCostLimitUsd" DOUBLE PRECISION CHECK ("iterationCostLimitUsd" IS NULL OR "iterationCostLimitUsd" >= 0),
  "providerSelectionAlgorithm" TEXT NOT NULL DEFAULT 'round-robin' CHECK ("providerSelectionAlgorithm" IN ('round-robin', 'highest-credit-percentage', 'highest-credit-absolute', 'weighted-round-robin', 'least-recently-used', 'priority-failover', 'health-aware-cooldown')),
  "providerSelectionCursor" INTEGER NOT NULL DEFAULT 0 CHECK ("providerSelectionCursor" >= 0),
  "runnerSelectionAlgorithm" TEXT NOT NULL DEFAULT 'round-robin' CHECK ("runnerSelectionAlgorithm" IN ('round-robin', 'highest-credit-percentage', 'highest-credit-absolute', 'weighted-round-robin', 'least-recently-used', 'priority-failover', 'health-aware-cooldown')),
  "runnerSelectionCursor" INTEGER NOT NULL DEFAULT 0 CHECK ("runnerSelectionCursor" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxLoopCreatedAt" ON "loop"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('loop');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loop', :'APP_ROLE_NAME')
\gexec
