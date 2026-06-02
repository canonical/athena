-- Normalized Ollama library model catalog persisted for Athena bootstrap and routing.
CREATE TABLE IF NOT EXISTS "model" (
  "source" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "summary" TEXT,
  "capabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "size" TEXT,
  "contextTokens" BIGINT,
  "inputTypes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "readmeMarkdown" TEXT,
  "license" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "fetchedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("source", "slug")
);

COMMENT ON TABLE "model" IS 'Cached Ollama library models for Athena.';
COMMENT ON COLUMN "model"."source" IS 'Catalog source that produced the model row.';
COMMENT ON COLUMN "model"."slug" IS 'Stable model variant slug, such as llama3.1:8b.';
COMMENT ON COLUMN "model"."href" IS 'Ollama library URL for the model variant.';
COMMENT ON COLUMN "model"."summary" IS 'Short model summary from the catalog.';
COMMENT ON COLUMN "model"."capabilities" IS 'Normalized model capabilities array.';
COMMENT ON COLUMN "model"."size" IS 'Published model size or usage label for the variant.';
COMMENT ON COLUMN "model"."contextTokens" IS 'Normalized numeric context window token count for the variant.';
COMMENT ON COLUMN "model"."inputTypes" IS 'Published input type labels for the variant.';
COMMENT ON COLUMN "model"."readmeMarkdown" IS 'Readme markdown extracted from the detail page.';
COMMENT ON COLUMN "model"."license" IS 'Normalized license metadata.';
COMMENT ON COLUMN "model"."fetchedAt" IS 'When Athena fetched this model record.';
COMMENT ON COLUMN "model"."createdAt" IS 'When the row was created.';
COMMENT ON COLUMN "model"."updatedAt" IS 'When the row was last updated.';

CREATE INDEX IF NOT EXISTS "idxModelSource" ON "model"("source");
CREATE INDEX IF NOT EXISTS "idxModelSlug" ON "model"("slug");
CREATE INDEX IF NOT EXISTS "idxModelFetchedAt" ON "model"("fetchedAt" DESC);

SELECT ensureUpdatedAtTrigger('model');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'model', :'APP_ROLE_NAME')
\gexec