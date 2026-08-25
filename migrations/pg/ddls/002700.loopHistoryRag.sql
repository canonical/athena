CREATE TABLE IF NOT EXISTS "loopHistoryRag" (
  "loop" UUID PRIMARY KEY REFERENCES "loop"("id") ON DELETE CASCADE,
  "provider" UUID NOT NULL REFERENCES "providerEmbedder"("provider") ON DELETE CASCADE,
  "generation" UUID NOT NULL DEFAULT uuidv7(),
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'indexing' CHECK ("status" IN ('missing', 'indexing', 'ready', 'failed')),
  "failureMessage" TEXT,
  "embeddingDimensions" INTEGER CHECK ("embeddingDimensions" IS NULL OR ("embeddingDimensions" > 0 AND "embeddingDimensions" <= 3072)),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT ensureUpdatedAtTrigger('loopHistoryRag');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopHistoryRag', :'APP_ROLE_NAME')
\gexec
