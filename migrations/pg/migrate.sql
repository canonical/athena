\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

\echo >>> Running Athena function migrations
\ir ./fncs/000100.uuidv7.sql
\ir ./fncs/000200.updatedAt.sql
\ir ./fncs/000300.ensureUpdatedAtTrigger.sql
\ir ./fncs/000400.personaAuditTrigger.sql

\echo >>> Running Athena DDL migrations
\ir ./ddls/000100.user.sql
\ir ./ddls/000200.loop.sql
\ir ./ddls/000300.loopUser.sql
\ir ./ddls/000400.event.sql
\ir ./ddls/000500.session.sql
\ir ./ddls/000600.persona.sql
\ir ./ddls/000700.personaAudit.sql
\ir ./ddls/999999.cleanup.sql

COMMIT;

\echo >>> Athena migrations completed successfully
