CREATE TABLE IF NOT EXISTS "loopRunnerRepository" (
  "loop" UUID NOT NULL,
  "runner" UUID NOT NULL,
  "repository" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "runner", "repository"),
  FOREIGN KEY ("loop", "runner") REFERENCES "loopRunner"("loop", "runner") ON DELETE CASCADE,
  FOREIGN KEY ("loop", "repository") REFERENCES "loopRepository"("loop", "repository") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idxLoopRunnerRepositoryLoopRepo" ON "loopRunnerRepository"("loop", "repository");
CREATE INDEX IF NOT EXISTS "idxLoopRunnerRepositoryLoopRunner" ON "loopRunnerRepository"("loop", "runner");

SELECT ensureUpdatedAtTrigger('loopRunnerRepository');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopRunnerRepository', :'APP_ROLE_NAME')
\gexec
