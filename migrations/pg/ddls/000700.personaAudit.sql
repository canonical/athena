-- Append-only audit log for persona profile create/update/delete actions
CREATE TABLE IF NOT EXISTS "personaAudit" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "persona" UUID REFERENCES "persona"("id") ON DELETE SET NULL,
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "actor" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL CHECK ("action" IN ('create', 'update', 'delete')),
  "changeSummary" TEXT NOT NULL,
  "snapshotBefore" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "snapshotAfter" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxPersonaAuditLoop" ON "personaAudit"("loop");
CREATE INDEX IF NOT EXISTS "idxPersonaAuditPersona" ON "personaAudit"("persona");
CREATE INDEX IF NOT EXISTS "idxPersonaAuditCreatedAt" ON "personaAudit"("createdAt" DESC);

SELECT format('GRANT SELECT, INSERT ON %I TO %I', 'personaAudit', :'APP_ROLE_NAME')
\gexec
