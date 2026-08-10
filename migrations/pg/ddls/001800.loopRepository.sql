CREATE TABLE IF NOT EXISTS "loopRepository" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "repository" UUID NOT NULL REFERENCES "repository"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "repository")
);

CREATE INDEX IF NOT EXISTS "idxLoopRepositoryLoop" ON "loopRepository"("loop");
CREATE INDEX IF NOT EXISTS "idxLoopRepositoryRepository" ON "loopRepository"("repository");

SELECT ensureUpdatedAtTrigger('loopRepository');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopRepository', :'APP_ROLE_NAME')
\gexec
