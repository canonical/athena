CREATE TABLE IF NOT EXISTS "loop" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxLoopUser" ON "loop"("user");
CREATE INDEX IF NOT EXISTS "idxLoopCreatedAt" ON "loop"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('loop');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loop', :'APP_ROLE_NAME')
\gexec
