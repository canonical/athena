-- Maps a loop's task sources to the step sequence used for tasks created from
-- that source. "taskSource" is an extensible discriminator (mirrors
-- "task"."source") rather than a hard-coded per-source table, so future task
-- sources only require widening the CHECK constraint. A missing mapping falls
-- back to the loop's default "stepSequence" at resolution time. Deleting a
-- mapped sequence cascades only to this configuration row, never to task
-- data.
CREATE TABLE IF NOT EXISTS "taskSourceStepSequence" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "taskSource" TEXT NOT NULL CHECK ("taskSource" IN ('user', 'workgraphItem')),
  "stepSequence" UUID NOT NULL REFERENCES "stepSequence"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("loop", "taskSource")
);

CREATE INDEX IF NOT EXISTS "idxTaskSourceStepSequenceLoop" ON "taskSourceStepSequence"("loop");
CREATE INDEX IF NOT EXISTS "idxTaskSourceStepSequenceStepSequence" ON "taskSourceStepSequence"("stepSequence");

SELECT ensureUpdatedAtTrigger('taskSourceStepSequence');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'taskSourceStepSequence', :'APP_ROLE_NAME')
\gexec
