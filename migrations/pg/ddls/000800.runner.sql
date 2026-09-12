CREATE TABLE IF NOT EXISTS "runner" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "credentialCiphertext" TEXT,
  "credentialIv" TEXT,
  "credentialAuthTag" TEXT,
  "credentialKeyVersion" TEXT NOT NULL DEFAULT 'v1',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("owner", "name"),
  CONSTRAINT "runner_type_check_v2" CHECK ("type" IN ('github-copilot-cloud', 'athena-workshop'))
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'runner'
      AND column_name = 'runnerType'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'runner'
      AND column_name = 'type'
  ) THEN
    ALTER TABLE "runner" RENAME COLUMN "runnerType" TO "type";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'runner'
      AND column_name = 'displayName'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'runner'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE "runner" RENAME COLUMN "displayName" TO "name";
  END IF;
END
$$;

UPDATE "runner"
SET "type" = 'athena-workshop'
WHERE "type" = 'juju-vm';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = '"runner"'::regclass
      AND conname = 'runner_type_check_v2'
  ) THEN
    ALTER TABLE "runner"
      DROP CONSTRAINT IF EXISTS "runner_runnerType_check";
    ALTER TABLE "runner"
      ADD CONSTRAINT "runner_type_check_v2" CHECK ("type" IN ('github-copilot-cloud', 'athena-workshop'));
  END IF;
END
$$;

ALTER TABLE "runner"
  ALTER COLUMN "credentialCiphertext" DROP NOT NULL,
  ALTER COLUMN "credentialIv" DROP NOT NULL,
  ALTER COLUMN "credentialAuthTag" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idxRunnerOwner" ON "runner"("owner");
CREATE INDEX IF NOT EXISTS "idxRunnerType" ON "runner"("type");

SELECT ensureUpdatedAtTrigger('runner');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'runner', :'APP_ROLE_NAME')
\gexec