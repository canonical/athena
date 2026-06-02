\set ON_ERROR_STOP on

BEGIN;

\echo >>> Running Athena function migrations
\ir ./fncs/000100.uuidv7.sql
\ir ./fncs/000200.updatedAt.sql
\ir ./fncs/000300.ensureUpdatedAtTrigger.sql

\echo >>> Running Athena DDL migrations
-- \ir ./ddls/000100.placeholder.sql

\echo >>> Running Athena seed migrations
-- \ir ./seed/000100.placeholder.sql

COMMIT;

\echo >>> Athena migrations completed successfully
