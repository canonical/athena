CREATE TABLE IF NOT EXISTS "loopWorkgraphItem" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loopWorkgraph" UUID NOT NULL REFERENCES "loopWorkgraph"("id") ON DELETE CASCADE,
  "itemKey" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "parentKey" TEXT,
  "title" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "status" TEXT,
  "webUrl" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("loopWorkgraph", "itemKey")
);

CREATE INDEX IF NOT EXISTS "idxLoopWorkgraphItemLoopWorkgraphParent"
  ON "loopWorkgraphItem"("loopWorkgraph", "parentKey");

SELECT ensureUpdatedAtTrigger('loopWorkgraphItem');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopWorkgraphItem', :'APP_ROLE_NAME')
\gexec
