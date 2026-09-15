CREATE TABLE IF NOT EXISTS "runnerToken" (
  "id" UUID PRIMARY KEY,
  "runner" UUID NOT NULL REFERENCES "runner"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "secretHash" TEXT UNIQUE,
  "expiresAt" TIMESTAMPTZ,
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxRunnerTokenRunner" ON "runnerToken"("runner");

ALTER TABLE "runnerToken"
  ALTER COLUMN "secretHash" DROP NOT NULL;

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'runnerToken', :'APP_ROLE_NAME')
\gexec
