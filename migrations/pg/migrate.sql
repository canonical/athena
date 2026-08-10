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
\ir ./ddls/000300.loopUser.sql
\ir ./ddls/000400.persona.sql
\ir ./ddls/000600.session.sql
\ir ./ddls/000700.loopPersona.sql
\ir './ddls/000800.runner.sql'
\ir ./ddls/000900.provider.sql
\ir './ddls/001000.loopRunner.sql'
\ir ./ddls/001100.loopProvider.sql
\ir ./ddls/001200.workgraph.sql
\ir ./ddls/001300.loopWorkgraph.sql
\ir ./ddls/001400.loopWorkgraphItem.sql
\ir ./ddls/000500.task.sql
\ir ./ddls/001500.webhook.sql
\ir ./ddls/001600.webhookItem.sql
\ir ./ddls/001700.repository.sql
\ir ./ddls/001800.loopRepository.sql
\ir ./ddls/999999.cleanup.sql

\echo >>> Running Athena seed data
\ir ./seed/000600.persona.seed.sql

COMMIT;

\echo >>> Athena migrations completed successfully
