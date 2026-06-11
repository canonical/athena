CREATE TABLE IF NOT EXISTS "loop" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxLoopUser" ON "loop"("user");
CREATE INDEX IF NOT EXISTS "idxLoopCreatedAt" ON "loop"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('loop');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loop', :'APP_ROLE_NAME')
\gexec

CREATE TABLE IF NOT EXISTS "loop_user" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("loop", "user")
);

CREATE INDEX IF NOT EXISTS "idxLoopUserUser" ON "loop_user"("user");

SELECT format('GRANT SELECT, INSERT, DELETE ON %I TO %I', 'loop_user', :'APP_ROLE_NAME')
\gexec
