CREATE TABLE IF NOT EXISTS "runner" (
  "id" TEXT PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('proprietary', 'open')),
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'post-mvp' CHECK ("lifecycleStatus" IN ('mvp', 'post-mvp', 'deprecated')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "runner" ("id", "displayName", "category", "lifecycleStatus") VALUES
  ('github-copilot-cloud', 'GitHub Copilot Cloud', 'proprietary', 'mvp'),
  ('juju-vm', 'Juju VM', 'open', 'post-mvp'),
  ('local-ubuntu', 'Local Ubuntu Binary', 'open', 'post-mvp')
ON CONFLICT ("id") DO NOTHING;

SELECT ensureUpdatedAtTrigger('runner');

SELECT format('GRANT SELECT ON %I TO %I', 'runner', :'APP_ROLE_NAME')
\gexec
