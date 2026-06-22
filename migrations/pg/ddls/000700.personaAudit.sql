-- Append-only audit log for persona profile create/update/delete actions.
-- Rows are inserted by the personaAuditTriggerFn trigger on the persona table;
-- actor is nullable because system-initiated operations (e.g. EM seed) may not have a user context.
CREATE TABLE IF NOT EXISTS "personaAudit" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "persona" UUID REFERENCES "persona"("id") ON DELETE SET NULL,
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "actor" TEXT REFERENCES "user"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL CHECK ("action" IN ('create', 'update', 'delete')),
  "changeSummary" TEXT NOT NULL,
  "snapshotBefore" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "snapshotAfter" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxPersonaAuditLoop" ON "personaAudit"("loop");
CREATE INDEX IF NOT EXISTS "idxPersonaAuditPersona" ON "personaAudit"("persona");
CREATE INDEX IF NOT EXISTS "idxPersonaAuditCreatedAt" ON "personaAudit"("createdAt" DESC);

-- Trigger: append an audit row after every persona INSERT, UPDATE, or DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'persona' AND t.tgname = 'personaAuditTrigger'
  ) THEN
    CREATE TRIGGER "personaAuditTrigger"
      AFTER INSERT OR UPDATE OR DELETE ON "persona"
      FOR EACH ROW EXECUTE FUNCTION personaAuditTriggerFn();
  END IF;
END;
$$;

SELECT format('GRANT SELECT, INSERT ON %I TO %I', 'personaAudit', :'APP_ROLE_NAME')
\gexec
