CREATE TABLE IF NOT EXISTS "loopWorkgraph" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "workgraph" UUID NOT NULL REFERENCES "workgraph"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "seedItems" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("seedItems") = 'array'),
  "hierarchyRules" JSONB NOT NULL DEFAULT '{"includeSubtasks":true,"statuses":[]}'::jsonb,
  "assignmentOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lastSyncedAt" TIMESTAMPTZ,
  "lastSyncStatus" TEXT NOT NULL DEFAULT 'never' CHECK ("lastSyncStatus" IN ('never', 'ok', 'failed')),
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "workgraph")
);

CREATE INDEX IF NOT EXISTS "idxLoopWorkgraphWorkgraph" ON "loopWorkgraph"("workgraph");

SELECT ensureUpdatedAtTrigger('loopWorkgraph');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopWorkgraph', :'APP_ROLE_NAME')
\gexec