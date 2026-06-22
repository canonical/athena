CREATE TABLE IF NOT EXISTS "persona" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "personality" TEXT NOT NULL,
  "usesCodingHarness" BOOLEAN NOT NULL DEFAULT FALSE,
  "isEngineeringManager" BOOLEAN NOT NULL DEFAULT FALSE,
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'active' CHECK ("lifecycleStatus" IN ('active', 'deprecated', 'archived')),
  "routingPriority" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxPersonaLoop" ON "persona"("loop");
CREATE INDEX IF NOT EXISTS "idxPersonaLifecycleStatus" ON "persona"("lifecycleStatus");

SELECT ensureUpdatedAtTrigger('persona');

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'persona', :'APP_ROLE_NAME')
\gexec
