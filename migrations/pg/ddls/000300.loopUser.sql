CREATE TABLE IF NOT EXISTS "loopUser" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "user")
);

CREATE INDEX IF NOT EXISTS "idxLoopUserLoop" ON "loopUser"("loop");
CREATE INDEX IF NOT EXISTS "idxLoopUserUser" ON "loopUser"("user");

SELECT format('GRANT SELECT, INSERT, DELETE ON %I TO %I', 'loopUser', :'APP_ROLE_NAME')
\gexec
