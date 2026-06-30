CREATE TABLE IF NOT EXISTS "loopPersona" (
  "loop" UUID NOT NULL REFERENCES "loop"("id") ON DELETE CASCADE,
  "persona" UUID NOT NULL REFERENCES "persona"("id") ON DELETE CASCADE,
  PRIMARY KEY ("loop", "persona"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxLoopPersonaLoop" ON "loopPersona"("loop");
CREATE INDEX IF NOT EXISTS "idxLoopPersonaPersona" ON "loopPersona"("persona");

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', 'loopPersona', :'APP_ROLE_NAME')
\gexec
