CREATE TABLE IF NOT EXISTS "workgraph" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('jira')),
  "baseUrl" TEXT NOT NULL CHECK ("baseUrl" ~* '^https://'),
  "projectKey" TEXT,
  "email" TEXT NOT NULL,
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "name")
);

CREATE INDEX IF NOT EXISTS "idxWorkgraphOwner" ON "workgraph"("owner");
CREATE INDEX IF NOT EXISTS "idxWorkgraphType" ON "workgraph"("type");

SELECT ensureUpdatedAtTrigger('workgraph');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'workgraph', :'APP_ROLE_NAME')
\gexec