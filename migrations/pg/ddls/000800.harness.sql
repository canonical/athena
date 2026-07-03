CREATE TABLE IF NOT EXISTS "harness" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "runnerType" TEXT NOT NULL CHECK ("runnerType" IN ('github-copilot-cloud', 'juju-vm')),
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "displayName")
);

CREATE INDEX IF NOT EXISTS "idxHarnessOwner" ON "harness"("owner");
CREATE INDEX IF NOT EXISTS "idxHarnessRunnerType" ON "harness"("runnerType");

SELECT ensureUpdatedAtTrigger('harness');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'harness', :'APP_ROLE_NAME')
\gexec
