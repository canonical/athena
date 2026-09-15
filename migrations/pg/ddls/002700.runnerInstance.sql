CREATE TABLE IF NOT EXISTS "runnerInstance" (
  "id" UUID PRIMARY KEY,
  "runner" UUID NOT NULL REFERENCES "runner"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "agentVersion" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "capacity" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "connectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxRunnerInstanceRunner" ON "runnerInstance"("runner");
CREATE INDEX IF NOT EXISTS "idxRunnerInstanceLastSeenAt" ON "runnerInstance"("lastSeenAt");

SELECT ensureUpdatedAtTrigger('runnerInstance');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'runnerInstance', :'APP_ROLE_NAME')
\gexec
