CREATE TABLE IF NOT EXISTS "repository" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "repositoryType" TEXT NOT NULL CHECK ("repositoryType" IN ('github')),
  "apiBaseUrl" TEXT NOT NULL CHECK ("apiBaseUrl" ~* '^https://'),
  "repositoryOwner" TEXT NOT NULL,
  "repositoryName" TEXT NOT NULL,
  "defaultBranch" TEXT,
  "credentialCiphertext" TEXT NOT NULL,
  "credentialIv" TEXT NOT NULL,
  "credentialAuthTag" TEXT NOT NULL,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "displayName"),
  UNIQUE ("owner", "repositoryType", "repositoryOwner", "repositoryName")
);

CREATE INDEX IF NOT EXISTS "idxRepositoryOwner" ON "repository"("owner");
CREATE INDEX IF NOT EXISTS "idxRepositoryType" ON "repository"("repositoryType");

SELECT ensureUpdatedAtTrigger('repository');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'repository', :'APP_ROLE_NAME')
\gexec
