CREATE TABLE IF NOT EXISTS "webhook" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "label" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "loopWorkgraph" UUID NOT NULL REFERENCES "loopWorkgraph"("id") ON DELETE CASCADE,
  "authHeaderName" TEXT NOT NULL DEFAULT 'X-Athena-Webhook-Key',
  "authSecretHash" TEXT NOT NULL,
  "securityMode" TEXT NOT NULL DEFAULT 'header',
  "securityConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  UNIQUE ("receiverId")
);

CREATE INDEX IF NOT EXISTS "idxWebhookLoopWorkgraph" ON "webhook"("loopWorkgraph");

SELECT ensureUpdatedAtTrigger('webhook');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'webhook', :'APP_ROLE_NAME')
\gexec
