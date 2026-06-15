CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "subject" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "picture" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE "user" IS 'Authenticated users.';
COMMENT ON COLUMN "user"."id" IS 'User identifier. This is the user email address.';
COMMENT ON COLUMN "user"."subject" IS 'OIDC subject identifier.';
COMMENT ON COLUMN "user"."name" IS 'Display name from the OIDC provider.';
COMMENT ON COLUMN "user"."picture" IS 'Profile picture URL from the OIDC provider.';
COMMENT ON COLUMN "user"."createdAt" IS 'When the user was first seen.';
COMMENT ON COLUMN "user"."updatedAt" IS 'Row update time.';

CREATE INDEX IF NOT EXISTS "idxUserSubject" ON "user"("subject");

SELECT ensureUpdatedAtTrigger('user');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'user', :'APP_ROLE_NAME')
\gexec