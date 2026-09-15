-- Ordered step definitions within a step sequence. See
-- docs/specs/definitions/task-steps.md for the persona/model selection policy
-- rules. Persona and model FKs intentionally omit ON DELETE actions so an
-- in-use persona/provider cannot be deleted out from under a pre-selected
-- policy; this keeps the CHECK constraints below always satisfiable.
CREATE TABLE IF NOT EXISTS "stepDefinition" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "stepSequence" UUID NOT NULL REFERENCES "stepSequence"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sequenceOrder" INTEGER NOT NULL,
  "instructions" TEXT NOT NULL,
  "personaSelectionPolicy" TEXT NOT NULL CHECK ("personaSelectionPolicy" IN ('preSelected', 'routingSelected')),
  "persona" UUID REFERENCES "persona"("id"),
  "modelSelectionPolicy" TEXT NOT NULL CHECK ("modelSelectionPolicy" IN ('preSelected', 'routingSelected')),
  "modelProvider" UUID REFERENCES "provider"("id"),
  "model" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("stepSequence", "name"),
  UNIQUE ("stepSequence", "sequenceOrder"),
  CHECK (
    ("personaSelectionPolicy" = 'preSelected' AND "persona" IS NOT NULL)
    OR ("personaSelectionPolicy" = 'routingSelected' AND "persona" IS NULL)
  ),
  CHECK (
    ("modelSelectionPolicy" = 'preSelected' AND "modelProvider" IS NOT NULL AND "model" IS NOT NULL)
    OR ("modelSelectionPolicy" = 'routingSelected' AND "modelProvider" IS NULL AND "model" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "idxStepDefinitionStepSequence" ON "stepDefinition"("stepSequence");
CREATE INDEX IF NOT EXISTS "idxStepDefinitionPersona" ON "stepDefinition"("persona");
CREATE INDEX IF NOT EXISTS "idxStepDefinitionModelProvider" ON "stepDefinition"("modelProvider");

SELECT ensureUpdatedAtTrigger('stepDefinition');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'stepDefinition', :'APP_ROLE_NAME')
\gexec
