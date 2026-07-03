CREATE TABLE IF NOT EXISTS "harnessDefinition" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "workerType" TEXT NOT NULL CHECK ("workerType" IN ('github-copilot-cloud-agent', 'openai-codex', 'claude-code', 'devin', 'juju-machine-charm')),
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "displayName")
);

CREATE INDEX IF NOT EXISTS "idxHarnessDefinitionOwner" ON "harnessDefinition"("owner");
CREATE INDEX IF NOT EXISTS "idxHarnessDefinitionWorkerType" ON "harnessDefinition"("workerType");

SELECT ensureUpdatedAtTrigger('harnessDefinition');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'harnessDefinition', :'APP_ROLE_NAME')
\gexec
