CREATE TABLE IF NOT EXISTS "loopInvite" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "invitedEmail" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "acceptedBy" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "revokedBy" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "acceptedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("acceptedAt" IS NULL OR "revokedAt" IS NULL)
);

CREATE INDEX IF NOT EXISTS "idxLoopInviteLoop" ON "loopInvite"("loop");
CREATE INDEX IF NOT EXISTS "idxLoopInviteInvitedEmail" ON "loopInvite"(LOWER("invitedEmail"));
CREATE UNIQUE INDEX IF NOT EXISTS "idxLoopInviteActivePerEmail" ON "loopInvite"("loop", LOWER("invitedEmail")) WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

SELECT ensureUpdatedAtTrigger('loopInvite');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopInvite', :'APP_ROLE_NAME')
\gexec
