CREATE TABLE IF NOT EXISTS "project" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxProjectCreatedAt" ON "project"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('project');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'project', :'APP_ROLE_NAME')
\gexec

CREATE TABLE IF NOT EXISTS "projectUser" (
  "project" UUID NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("project", "user")
);

CREATE INDEX IF NOT EXISTS "idxProjectUserProject" ON "projectUser"("project");
CREATE INDEX IF NOT EXISTS "idxProjectUserUser" ON "projectUser"("user");

SELECT format('GRANT SELECT, INSERT, DELETE ON %I TO %I', 'projectUser', :'APP_ROLE_NAME')
\gexec
