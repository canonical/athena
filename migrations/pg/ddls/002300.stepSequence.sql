-- Loop-level named step sequences. Renaming or deleting a sequence must never
-- mutate or cascade into task data (see docs/specs/definitions/task-steps.md).
CREATE TABLE IF NOT EXISTS "stepSequence" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("loop", "name")
);

CREATE INDEX IF NOT EXISTS "idxStepSequenceLoop" ON "stepSequence"("loop");
CREATE UNIQUE INDEX IF NOT EXISTS "idxStepSequenceLoopDefault" ON "stepSequence"("loop") WHERE "isDefault" = TRUE;

SELECT ensureUpdatedAtTrigger('stepSequence');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'stepSequence', :'APP_ROLE_NAME')
\gexec
