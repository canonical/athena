\set ON_ERROR_STOP on

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('athena-schema-migrations', 0));

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
		RAISE EXCEPTION 'The vector extension is not installed. Install it before Athena schema migrations.';
	END IF;
END
$$;

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
\ir ./ddls/001900.loopInvite.sql
\ir ./ddls/002000.loopUserRoleAudit.sql
\ir ./ddls/002100.runnerQueue.sql
\ir ./ddls/002200.loopRunnerRepository.sql
\ir ./ddls/002500.ragIndex.sql
\ir ./ddls/002700.loopActivityObservation.sql
\ir ./ddls/002800.ragEntry.sql
\ir ./ddls/999999.cleanup.sql

\echo >>> Running Athena seed data
\ir ./seed/000600.persona.seed.sql

COMMIT;

\echo >>> Athena migrations completed successfully
