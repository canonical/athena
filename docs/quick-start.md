# Athena quick start

This guide is the fastest way to get Athena running locally for evaluation.

## Prerequisites

- Docker with Compose support
- A free `:80` port on your machine

## Start Athena

1. Create a local environment file from the checked-in sample:

   ```bash
   cp .example.env .env
   ```

2. Start the local stack:

   ```bash
   docker compose up --build
   ```

3. Open Athena at [http://athena.localhost](http://athena.localhost).

4. Sign in through Dex with one of the seeded local users:

   - Email: `dev.user@canonical.com`
   - Password: `password`

## What starts

- Athena: [http://athena.localhost](http://athena.localhost)
- Dex: [http://dex.localhost/dex](http://dex.localhost/dex)
- PostgreSQL: `localhost:5432`

The Compose stack also runs the database migration step automatically before Athena starts.

## Use Athena loops

After sign-in, these are the minimum steps to make a loop usable.

1. Create a loop.
2. Open the new loop.
3. Confirm the loop has one active routing persona and at least one active execution persona. New loops receive default personas, so this is usually already satisfied.
4. Create a provider from the global provider area.
5. Configure that provider with a default model and at least one enabled model.
6. Assign the provider to your loop and make sure the assignment is active.
7. Create a runner from the global runner area.
8. Assign the runner to your loop and make sure the assignment is active.
9. Create a workgraph from the global workgraph area.
10. Assign the workgraph to your loop and make sure the assignment is active.
11. Configure the loop workgraph assignment with a JQL query.
12. Open the loop Tasks tab and verify the loop is no longer blocked.
13. Click New Task to create your first task.
14. Open the task, write your first message in the message box, and click Send.
15. If you want Athena to ingest work automatically from the workgraph, start synchronization for the assigned workgraph after the JQL query is configured.
16. After workgraph sync is enabled and started, Athena can create tasks automatically from synced workgraph items.

## Create a local seed file

When your local Athena loop is in the shape you want, you can snapshot that data into a local-only seed file at [../migrations/pg/seed.local/local.seed.sql](../migrations/pg/seed.local/local.seed.sql).

Start from the template in [./local.seed.template.sql](./local.seed.template.sql), copy it into `migrations/pg/seed.local/local.seed.sql`, and replace only the values in the `DECLARE` block.

```bash
cp docs/local.seed.template.sql migrations/pg/seed.local/local.seed.sql
```

Run this query in `psql`, update the `target` CTE for your user and loop name, and paste the result into the `DECLARE` block of `local.seed.sql`.

```sql
WITH target AS (
   SELECT
      'dev.user@canonical.com'::text AS user_id,
      'Self Loop'::text AS loop_name
),
selected_loop AS (
   SELECT l.*, lu."user" AS user_id
   FROM "loop" l
   JOIN "loopUser" lu ON lu."loop" = l."id"
   JOIN target t ON t.user_id = lu."user" AND t.loop_name = l."name"
   LIMIT 1
),
selected_user AS (
   SELECT u.*
   FROM "user" u
   JOIN target t ON t.user_id = u."id"
),
selected_provider AS (
   SELECT p.*, lp."priority"
   FROM selected_loop sl
   JOIN "loopProvider" lp ON lp."loop" = sl."id"
   JOIN "provider" p ON p."id" = lp."provider"
   ORDER BY lp."priority" NULLS LAST, p."createdAt"
   LIMIT 1
),
selected_runner AS (
   SELECT r.*, lr."priority"
   FROM selected_loop sl
   JOIN "loopRunner" lr ON lr."loop" = sl."id"
   JOIN "runner" r ON r."id" = lr."runner"
   ORDER BY lr."priority" NULLS LAST, r."createdAt"
   LIMIT 1
),
selected_repository AS (
   SELECT r.*
   FROM selected_loop sl
   JOIN "loopRepository" lr ON lr."loop" = sl."id"
   JOIN "repository" r ON r."id" = lr."repository"
   ORDER BY r."createdAt"
   LIMIT 1
),
selected_workgraph AS (
   SELECT w.*, lw."assignmentConfig", lw."id" AS loop_workgraph_id
   FROM selected_loop sl
   JOIN "loopWorkgraph" lw ON lw."loop" = sl."id"
   JOIN "workgraph" w ON w."id" = lw."workgraph"
   ORDER BY w."createdAt"
   LIMIT 1
),
selected_webhook AS (
   SELECT wh.*
   FROM selected_workgraph swg
   LEFT JOIN "webhook" wh ON wh."loopWorkgraph" = swg.loop_workgraph_id
   ORDER BY wh."createdAt"
   LIMIT 1
),
lines AS (
   SELECT 10 AS ord, '  -- User Definitions' AS line
   UNION ALL SELECT 11, format('  v_user_id TEXT := %L;', su."id") FROM selected_user su
   UNION ALL SELECT 12, format('  v_user_name TEXT := %L;', su."name") FROM selected_user su
   UNION ALL SELECT 13, format('  v_user_picture TEXT := %s;', quote_nullable(su."picture")) FROM selected_user su
   UNION ALL SELECT 20, ''
   UNION ALL SELECT 21, '  -- Loop Definitions'
   UNION ALL SELECT 22, format('  v_loop_id UUID := %L;', sl."id") FROM selected_loop sl
   UNION ALL SELECT 23, format('  v_loop_name TEXT := %L;', sl."name") FROM selected_loop sl
   UNION ALL SELECT 24, format('  v_loop_iteration_cost_limit_usd NUMERIC := %s;', COALESCE(sl."iterationCostLimitUsd"::text, 'NULL')) FROM selected_loop sl
   UNION ALL SELECT 30, ''
   UNION ALL SELECT 31, '  -- Provider Definitions'
   UNION ALL SELECT 32, format('  v_provider_id UUID := %L;', sp."id") FROM selected_provider sp
   UNION ALL SELECT 33, format('  v_provider_display_name TEXT := %L;', sp."displayName") FROM selected_provider sp
   UNION ALL SELECT 34, format('  v_provider_type TEXT := %L;', sp."providerType") FROM selected_provider sp
   UNION ALL SELECT 35, format('  v_provider_base_url TEXT := %s;', quote_nullable(sp."baseUrl")) FROM selected_provider sp
   UNION ALL SELECT 36, format('  v_provider_credential_ciphertext TEXT := %L;', sp."credentialCiphertext") FROM selected_provider sp
   UNION ALL SELECT 37, format('  v_provider_credential_iv TEXT := %L;', sp."credentialIv") FROM selected_provider sp
   UNION ALL SELECT 38, format('  v_provider_credential_auth_tag TEXT := %L;', sp."credentialAuthTag") FROM selected_provider sp
   UNION ALL SELECT 39, format('  v_provider_credential_key_version TEXT := %L;', sp."credentialKeyVersion") FROM selected_provider sp
   UNION ALL SELECT 40, format('  v_provider_default_model TEXT := %s;', quote_nullable(sp."defaultModel")) FROM selected_provider sp
   UNION ALL SELECT 41, format(
      '  v_provider_enabled_models TEXT[] := ARRAY[%s];',
      COALESCE((SELECT string_agg(format('%L', model), ',') FROM unnest(sp."enabledModels") AS model), '')
   ) FROM selected_provider sp
   UNION ALL SELECT 42, format('  v_provider_priority INTEGER := %s;', COALESCE(sp."priority"::text, 'NULL')) FROM selected_provider sp
   UNION ALL SELECT 50, ''
   UNION ALL SELECT 51, '  -- Runner Definitions'
   UNION ALL SELECT 52, format('  v_runner_display_name TEXT := %L;', sr."displayName") FROM selected_runner sr
   UNION ALL SELECT 53, format('  v_runner_type TEXT := %L;', sr."runnerType") FROM selected_runner sr
   UNION ALL SELECT 54, format('  v_runner_credential_ciphertext TEXT := %L;', sr."credentialCiphertext") FROM selected_runner sr
   UNION ALL SELECT 55, format('  v_runner_credential_iv TEXT := %L;', sr."credentialIv") FROM selected_runner sr
   UNION ALL SELECT 56, format('  v_runner_credential_auth_tag TEXT := %L;', sr."credentialAuthTag") FROM selected_runner sr
   UNION ALL SELECT 57, format('  v_runner_credential_key_version TEXT := %L;', sr."credentialKeyVersion") FROM selected_runner sr
   UNION ALL SELECT 58, format('  v_runner_priority INTEGER := %s;', COALESCE(sr."priority"::text, 'NULL')) FROM selected_runner sr
   UNION ALL SELECT 59, format('  v_runner_id UUID := %L;', sr."id") FROM selected_runner sr
   UNION ALL SELECT 60, ''
   UNION ALL SELECT 61, '  -- Repository Definitions'
   UNION ALL SELECT 62, format('  v_repository_display_name TEXT := %L;', sr."displayName") FROM selected_repository sr
   UNION ALL SELECT 63, format('  v_repository_type TEXT := %L;', sr."repositoryType") FROM selected_repository sr
   UNION ALL SELECT 64, format('  v_repository_api_base_url TEXT := %L;', sr."apiBaseUrl") FROM selected_repository sr
   UNION ALL SELECT 65, format('  v_repository_owner TEXT := %L;', sr."repositoryOwner") FROM selected_repository sr
   UNION ALL SELECT 66, format('  v_repository_name TEXT := %L;', sr."repositoryName") FROM selected_repository sr
   UNION ALL SELECT 67, format('  v_repository_default_branch TEXT := %L;', sr."defaultBranch") FROM selected_repository sr
   UNION ALL SELECT 68, format('  v_repository_credential_ciphertext TEXT := %L;', sr."credentialCiphertext") FROM selected_repository sr
   UNION ALL SELECT 69, format('  v_repository_credential_iv TEXT := %L;', sr."credentialIv") FROM selected_repository sr
   UNION ALL SELECT 70, format('  v_repository_credential_auth_tag TEXT := %L;', sr."credentialAuthTag") FROM selected_repository sr
   UNION ALL SELECT 71, format('  v_repository_credential_key_version TEXT := %L;', sr."credentialKeyVersion") FROM selected_repository sr
   UNION ALL SELECT 72, format('  v_repository_lifecycle_status TEXT := %L;', sr."lifecycleStatus") FROM selected_repository sr
   UNION ALL SELECT 73, format('  v_repository_id UUID := %L;', sr."id") FROM selected_repository sr
   UNION ALL SELECT 80, ''
   UNION ALL SELECT 81, '  -- Workgraph Definitions'
   UNION ALL SELECT 82, format('  v_workgraph_name TEXT := %L;', swg."name") FROM selected_workgraph swg
   UNION ALL SELECT 83, format('  v_workgraph_type TEXT := %L;', swg."type") FROM selected_workgraph swg
   UNION ALL SELECT 84, format('  v_workgraph_base_url TEXT := %L;', swg."baseUrl") FROM selected_workgraph swg
   UNION ALL SELECT 85, format('  v_workgraph_browse_base_url TEXT := %s;', quote_nullable(swg."browseBaseUrl")) FROM selected_workgraph swg
   UNION ALL SELECT 86, format('  v_workgraph_project_key TEXT := %s;', quote_nullable(swg."projectKey")) FROM selected_workgraph swg
   UNION ALL SELECT 87, format('  v_workgraph_email TEXT := %s;', quote_nullable(swg."email")) FROM selected_workgraph swg
   UNION ALL SELECT 88, format('  v_workgraph_credential_ciphertext TEXT := %L;', swg."credentialCiphertext") FROM selected_workgraph swg
   UNION ALL SELECT 89, format('  v_workgraph_credential_iv TEXT := %L;', swg."credentialIv") FROM selected_workgraph swg
   UNION ALL SELECT 90, format('  v_workgraph_credential_auth_tag TEXT := %L;', swg."credentialAuthTag") FROM selected_workgraph swg
   UNION ALL SELECT 91, format('  v_workgraph_credential_key_version TEXT := %L;', swg."credentialKeyVersion") FROM selected_workgraph swg
   UNION ALL SELECT 92, format('  v_workgraph_jql TEXT := %s;', quote_nullable(swg."assignmentConfig" ->> '"'"'jql'"'"')) FROM selected_workgraph swg
   UNION ALL SELECT 93, format('  v_workgraph_id UUID := %L;', swg."id") FROM selected_workgraph swg
   UNION ALL SELECT 100, ''
   UNION ALL SELECT 101, '  -- Webhook Definitions'
   UNION ALL SELECT 102, format('  v_webhook_label TEXT := %s;', quote_nullable(sw."label")) FROM selected_webhook sw
   UNION ALL SELECT 103, format('  v_webhook_receiver_id TEXT := %s;', quote_nullable(sw."receiverId")) FROM selected_webhook sw
   UNION ALL SELECT 104, format('  v_webhook_type TEXT := %s;', quote_nullable(sw."type")) FROM selected_webhook sw
   UNION ALL SELECT 105, format('  v_webhook_auth_header_name TEXT := %s;', quote_nullable(sw."authHeaderName")) FROM selected_webhook sw
   UNION ALL SELECT 106, format('  v_webhook_auth_secret_hash TEXT := %s;', quote_nullable(sw."authSecretHash")) FROM selected_webhook sw
   UNION ALL SELECT 107, format('  v_webhook_security_mode TEXT := %s;', quote_nullable(sw."securityMode")) FROM selected_webhook sw
   UNION ALL SELECT 108, format('  v_webhook_security_config JSONB := %L::jsonb;', COALESCE(sw."securityConfig", '{}'::jsonb)::text) FROM selected_webhook sw
)
SELECT string_agg(line, E'\n' ORDER BY ord)
FROM lines;
```


The `prepare` service automatically runs every `.sql` file under `migrations/pg/seed.local`, so your `local.seed.sql` will be applied the next time the local stack starts as well.