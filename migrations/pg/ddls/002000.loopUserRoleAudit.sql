CREATE TABLE IF NOT EXISTS "loopUserRoleAudit" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "changedBy" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "wasAdmin" BOOLEAN NOT NULL,
  "isAdmin" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("wasAdmin" <> "isAdmin")
);

CREATE INDEX IF NOT EXISTS "idxLoopUserRoleAuditLoop" ON "loopUserRoleAudit"("loop");
CREATE INDEX IF NOT EXISTS "idxLoopUserRoleAuditUser" ON "loopUserRoleAudit"("user");
CREATE INDEX IF NOT EXISTS "idxLoopUserRoleAuditChangedBy" ON "loopUserRoleAudit"("changedBy");

SELECT format('GRANT SELECT, INSERT ON %I TO %I', 'loopUserRoleAudit', :'APP_ROLE_NAME')
\gexec
