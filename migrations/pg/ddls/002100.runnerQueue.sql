CREATE TABLE IF NOT EXISTS "runnerQueue" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "task" UUID NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
  "runner" UUID NOT NULL REFERENCES "runner"("id") ON DELETE CASCADE,
  "prompt" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'claimed', 'completed', 'failed')),
  "claimedBy" UUID NULL,
  "claimedAt" TIMESTAMPTZ NULL,
  "result" TEXT NULL,
  "error" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxRunnerQueueRunnerStatus" ON "runnerQueue"("runner", "status");
CREATE INDEX IF NOT EXISTS "idxRunnerQueueTask" ON "runnerQueue"("task");
CREATE INDEX IF NOT EXISTS "idxRunnerQueueLoop" ON "runnerQueue"("loop");

SELECT ensureUpdatedAtTrigger('runnerQueue');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'runnerQueue', :'APP_ROLE_NAME')
\gexec
