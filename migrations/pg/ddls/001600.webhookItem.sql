CREATE TABLE IF NOT EXISTS "webhookItem" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'processing', 'done')),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idxWebhookItemStatus" ON "webhookItem"("status");

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'webhookItem', :'APP_ROLE_NAME')
\gexec
