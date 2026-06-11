\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

\echo >>> Running Athena function migrations
\ir ./fncs/000100.uuidv7.sql
\ir ./fncs/000200.updatedAt.sql
\ir ./fncs/000300.ensureUpdatedAtTrigger.sql

\echo >>> Running Athena DDL migrations
\ir ./ddls/000100.user.sql
\ir ./ddls/000200.loop.sql
\ir ./ddls/000300.event.sql
\ir ./ddls/000400.session.sql
\ir ./ddls/999999.cleanup.sql

COMMIT;

\echo >>> Athena migrations completed successfully