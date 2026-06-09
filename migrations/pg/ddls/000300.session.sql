CREATE TABLE IF NOT EXISTS "session" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "user" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "idToken" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE "session" IS 'Server-side authentication sessions and OAuth credentials.';
COMMENT ON COLUMN "session"."id" IS 'Session identifier exposed to the browser session cookie.';
COMMENT ON COLUMN "session"."user" IS 'Authenticated user email address.';
COMMENT ON COLUMN "session"."idToken" IS 'OIDC ID token retained server-side only.';
COMMENT ON COLUMN "session"."accessToken" IS 'OIDC access token retained server-side only.';

CREATE INDEX IF NOT EXISTS "idxSessionUser" ON "session"("user");
CREATE INDEX IF NOT EXISTS "idxSessionCreatedAt" ON "session"("createdAt" DESC);

SELECT ensureUpdatedAtTrigger('session');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'session', :'APP_ROLE_NAME')
\gexec