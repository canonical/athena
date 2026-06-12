CREATE TABLE IF NOT EXISTS "loop" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "project" UUID NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxLoopProject" ON "loop"("project");
CREATE INDEX IF NOT EXISTS "idxLoopCreatedAt" ON "loop"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('loop');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loop', :'APP_ROLE_NAME')
\gexec
