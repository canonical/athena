ALTER TABLE "loop"
  ADD COLUMN IF NOT EXISTS "openRouterSelectionAlgorithm" TEXT NOT NULL DEFAULT 'round-robin' CHECK ("openRouterSelectionAlgorithm" IN ('round-robin', 'highest-credit-percentage', 'highest-credit-absolute', 'weighted-round-robin', 'least-recently-used', 'priority-failover', 'health-aware-cooldown')),
  ADD COLUMN IF NOT EXISTS "copilotSelectionAlgorithm" TEXT NOT NULL DEFAULT 'round-robin' CHECK ("copilotSelectionAlgorithm" IN ('round-robin', 'highest-credit-percentage', 'highest-credit-absolute', 'weighted-round-robin', 'least-recently-used', 'priority-failover', 'health-aware-cooldown')),
  ADD COLUMN IF NOT EXISTS "openRouterSelectionCursor" INTEGER NOT NULL DEFAULT 0 CHECK ("openRouterSelectionCursor" >= 0),
  ADD COLUMN IF NOT EXISTS "copilotSelectionCursor" INTEGER NOT NULL DEFAULT 0 CHECK ("copilotSelectionCursor" >= 0),
  ADD COLUMN IF NOT EXISTS "selectionCooldownWindowMs" INTEGER NOT NULL DEFAULT 300000 CHECK ("selectionCooldownWindowMs" BETWEEN 1000 AND 86400000);
