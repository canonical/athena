-- Copy this file to migrations/pg/seed.local/local.seed.sql and replace the values in the DECLARE block.
-- The SQL body below should usually stay unchanged.
DO $$
DECLARE
  -- User Definitions
  v_user_id TEXT := '<user-email>';
  v_user_name TEXT := '<user-name>';
  v_user_picture TEXT := '';

  -- Loop Definitions
  v_loop_id UUID := '<loop-id>';
  v_loop_name TEXT := '<loop-name>';
  v_loop_iteration_cost_limit_usd NUMERIC := 0.1;

  -- Provider Definitions
  v_provider_id UUID := '<provider-id>';
  v_provider_display_name TEXT := '<provider-display-name>';
  v_provider_type TEXT := '<provider-type>';
  v_provider_base_url TEXT := '<provider-base-url>';
  v_provider_credential_ciphertext TEXT := '<provider-credential-ciphertext>';
  v_provider_credential_iv TEXT := '<provider-credential-iv>';
  v_provider_credential_auth_tag TEXT := '<provider-credential-auth-tag>';
  v_provider_credential_key_version TEXT := '<provider-credential-key-version>';
  v_provider_default_model TEXT := '<provider-default-model>';
  v_provider_enabled_models TEXT[] := ARRAY['<provider-enabled-model-1>'];
  v_provider_priority INTEGER := 1;


  -- Runner Definitions
  v_runner_display_name TEXT := '<runner-display-name>';
  v_runner_type TEXT := '<runner-type>';
  v_runner_credential_ciphertext TEXT := '<runner-credential-ciphertext>';
  v_runner_credential_iv TEXT := '<runner-credential-iv>';
  v_runner_credential_auth_tag TEXT := '<runner-credential-auth-tag>';
  v_runner_credential_key_version TEXT := '<runner-credential-key-version>';
  v_runner_priority INTEGER := 1;

  v_runner_id UUID := '<runner-id>';

  -- Repository Definitions
  v_repository_display_name TEXT := '<repository-display-name>';
  v_repository_type TEXT := '<repository-type>';
  v_repository_api_base_url TEXT := '<repository-api-base-url>';
  v_repository_owner TEXT := '<repository-owner>';
  v_repository_name TEXT := '<repository-name>';
  v_repository_default_branch TEXT := '<repository-default-branch>';
  v_repository_credential_ciphertext TEXT := '<repository-credential-ciphertext>';
  v_repository_credential_iv TEXT := '<repository-credential-iv>';
  v_repository_credential_auth_tag TEXT := '<repository-credential-auth-tag>';
  v_repository_credential_key_version TEXT := '<repository-credential-key-version>';
  v_repository_lifecycle_status TEXT := 'active';

  v_repository_id UUID := '<repository-id>';

  -- Workgraph Definitions
  v_workgraph_name TEXT := '<workgraph-name>';
  v_workgraph_type TEXT := '<workgraph-type>';
  v_workgraph_base_url TEXT := '<workgraph-base-url>';
  v_workgraph_browse_base_url TEXT := '<workgraph-browse-base-url>';
  v_workgraph_project_key TEXT := '<workgraph-project-key>';
  v_workgraph_email TEXT := '<workgraph-email>';
  v_workgraph_credential_ciphertext TEXT := '<workgraph-credential-ciphertext>';
  v_workgraph_credential_iv TEXT := '<workgraph-credential-iv>';
  v_workgraph_credential_auth_tag TEXT := '<workgraph-credential-auth-tag>';
  v_workgraph_credential_key_version TEXT := '<workgraph-credential-key-version>';
  v_workgraph_jql TEXT := '<workgraph-jql>';

  v_workgraph_id UUID := '<workgraph-id>';

  -- Webhook Definitions
  v_webhook_label TEXT := '<webhook-label>';
  v_webhook_receiver_id TEXT := '<webhook-receiver-id>';
  v_webhook_type TEXT := '<webhook-type>';
  v_webhook_auth_header_name TEXT := '<webhook-auth-header-name>';
  v_webhook_auth_secret_hash TEXT := '<webhook-auth-secret-hash>';
  v_webhook_security_mode TEXT := '<webhook-security-mode>';
  v_webhook_security_config JSONB := '{}'::jsonb;
BEGIN
  INSERT INTO "user" ("id", "subject", "name", "picture")
  VALUES (v_user_id, v_user_id, v_user_name, v_user_picture)
  ON CONFLICT ("id") DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM "loop" l
    JOIN "loopUser" lu ON lu."loop" = l."id"
    WHERE l."name" = v_loop_name AND lu."user" = v_user_id
  ) THEN
    INSERT INTO "loop" ("id", "name", "iterationCostLimitUsd") VALUES (v_loop_id, v_loop_name, v_loop_iteration_cost_limit_usd) RETURNING "id" INTO v_loop_id;
    INSERT INTO "loopUser" ("loop", "user", "isAdmin") VALUES (v_loop_id, v_user_id, TRUE);

    INSERT INTO "loopPersona" ("loop", "persona")
    SELECT v_loop_id, "id" FROM "persona" WHERE "isDefault" = TRUE
    ON CONFLICT DO NOTHING;
  ELSE
    SELECT l."id" INTO v_loop_id
    FROM "loop" l
    JOIN "loopUser" lu ON lu."loop" = l."id"
    WHERE l."name" = v_loop_name AND lu."user" = v_user_id
    LIMIT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "provider" WHERE "owner" = v_user_id AND "displayName" = v_provider_display_name
  ) THEN
    INSERT INTO "provider" (
      "id", "owner", "displayName", "providerType", "baseUrl",
      "credentialCiphertext", "credentialIv", "credentialAuthTag", "credentialKeyVersion"
    )
    VALUES (
      v_provider_id, v_user_id, v_provider_display_name, v_provider_type, v_provider_base_url,
      v_provider_credential_ciphertext, v_provider_credential_iv, v_provider_credential_auth_tag, v_provider_credential_key_version
    )
    RETURNING "id" INTO v_provider_id;

    INSERT INTO "loopProvider" ("loop", "provider", "priority")
    VALUES (v_loop_id, v_provider_id, v_provider_priority)
    ON CONFLICT DO NOTHING;
  ELSE
    SELECT "id" INTO v_provider_id
    FROM "provider"
    WHERE "owner" = v_user_id
      AND "displayName" = v_provider_display_name
    LIMIT 1;
  END IF;

  IF v_provider_id IS NOT NULL THEN
    UPDATE "provider"
    SET
      "defaultModel" = v_provider_default_model,
      "enabledModels" = v_provider_enabled_models
    WHERE "id" = v_provider_id;

    INSERT INTO "loopProvider" ("loop", "provider", "priority")
    VALUES (v_loop_id, v_provider_id, v_provider_priority)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "runner" WHERE "owner" = v_user_id AND "displayName" = v_runner_display_name
  ) THEN
    INSERT INTO "runner" (
      "id", "owner", "displayName", "runnerType",
      "credentialCiphertext", "credentialIv", "credentialAuthTag", "credentialKeyVersion"
    )
    VALUES (
      v_runner_id, v_user_id, v_runner_display_name, v_runner_type,
      v_runner_credential_ciphertext, v_runner_credential_iv, v_runner_credential_auth_tag, v_runner_credential_key_version
    )
    RETURNING "id" INTO v_runner_id;

    INSERT INTO "loopRunner" ("loop", "runner", "priority")
    VALUES (v_loop_id, v_runner_id, v_runner_priority)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "workgraph" WHERE "owner" = v_user_id AND "name" = v_workgraph_name
  ) THEN
    INSERT INTO "workgraph" (
      "id", "owner", "name", "type", "baseUrl", "browseBaseUrl", "projectKey", "email",
      "credentialCiphertext", "credentialIv", "credentialAuthTag", "credentialKeyVersion"
    )
    VALUES (
      v_workgraph_id, v_user_id, v_workgraph_name, v_workgraph_type, v_workgraph_base_url, v_workgraph_browse_base_url, v_workgraph_project_key, v_workgraph_email,
      v_workgraph_credential_ciphertext, v_workgraph_credential_iv, v_workgraph_credential_auth_tag, v_workgraph_credential_key_version
    )
    RETURNING "id" INTO v_workgraph_id;
  ELSE
    SELECT "id" INTO v_workgraph_id
    FROM "workgraph"
    WHERE "owner" = v_user_id
      AND "name" = v_workgraph_name
    LIMIT 1;
  END IF;

  IF v_workgraph_id IS NOT NULL THEN
    UPDATE "workgraph"
    SET
      "projectKey" = v_workgraph_project_key,
      "browseBaseUrl" = v_workgraph_browse_base_url,
      "credentialCiphertext" = v_workgraph_credential_ciphertext,
      "credentialIv" = v_workgraph_credential_iv,
      "credentialAuthTag" = v_workgraph_credential_auth_tag,
      "credentialKeyVersion" = v_workgraph_credential_key_version
    WHERE "id" = v_workgraph_id;

    INSERT INTO "loopWorkgraph" ("loop", "workgraph")
    VALUES (v_loop_id, v_workgraph_id)
    ON CONFLICT DO NOTHING;

    UPDATE "loopWorkgraph"
    -- Jira issue type IDs used below for typeInstructions:
    -- 10390 = Objective
    -- 10000 = Epic
    -- 12392 = Project-Issue
    -- 12391 = Project-Risk
    -- 10002 = Story
    -- 10013 = Task
    -- 10015 = Bug
    -- 10037 = Spike
    -- 10014 = Sub-task
    SET "assignmentConfig" = jsonb_build_object(
      'jql',
      v_workgraph_jql,
      'typeInstructions',
      jsonb_build_object(
        '10390',
        'Treat Objective as the top-level project item.
    First, determine whether the Objective is refined enough to act on.
    If the description is missing, unclear, or does not contain enough information to refine, gather the missing context before proceeding.
    Research the Objective, identify ambiguity, and chat with the user whenever needed to clarify intent, scope, constraints, dependencies, and success criteria.

    Produce a refined Objective description that clearly states:
    - the problem or opportunity
    - the expected outcome
    - scope boundaries
    - key dependencies or assumptions
    - concrete success criteria

    If additional refinement is needed, routing should continue assigning the task to the most appropriate persona until the Objective is clear enough to decompose.

    Once the Objective is sufficiently refined, route it to the appropriate persona to analyze the existing child items.
    Review the current children, identify gaps or outdated items, propose updates to existing children, and propose any new children needed to deliver the Objective.

    Children of an Objective should be treated as Epics.
  Do not treat Objective refinement as complete until both the Objective itself and its Epic-level decomposition are coherent and actionable.',
    '10000',
    'Treat Epic as a milestone within an Objective.
  An Epic should represent a meaningful delivery outcome that advances the parent Objective.
  It should be large enough to group related work, but focused enough to have a clear purpose, boundaries, and definition of progress.

  First, determine whether the Epic is clearly defined.
  If the description is missing, unclear, or does not contain enough information to refine, gather the missing context before proceeding.
  Research the Epic, review the parent Objective and sibling milestone-level items, and chat with the user whenever needed to clarify scope, intent, constraints, dependencies, and success criteria.

  Produce a refined Epic description that clearly states:
  - the milestone outcome
  - how it supports the parent Objective
  - scope boundaries
  - dependencies and sequencing constraints
  - concrete success criteria

  The first child of an Epic should be a Story that captures the specification work for the Epic.
  After the specification Story, the remaining children are expected to be Tasks that deliver the Epic.

  Review the existing child items of the Epic.
  Identify gaps, outdated items, overlaps, and missing work.
  Propose updates to existing children and propose any new children needed to deliver the Epic milestone.

  Children of an Epic should primarily be the specification Story followed by Tasks.
  Use Bugs or Spikes only when the work genuinely requires defect handling or research.
  Do not create Project-Issue or Project-Risk as children of an Epic unless the hierarchy in Jira explicitly allows that relationship.
  Do not treat Epic refinement as complete until both the Epic itself and its delivery-level decomposition are coherent and actionable.',
    '12392',
    'Treat Project-Issue as a project-level issue that affects delivery of the parent Objective.
  A Project-Issue is not normal implementation work. Use it to capture blockers, cross-cutting project problems, unresolved external dependencies, or coordination gaps that need explicit ownership and follow-up.

  First, determine whether the Project-Issue is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Research the issue, review the related Objective and sibling milestone-level items, and chat with the user whenever needed to clarify impact, urgency, ownership, and resolution options.

  Produce a refined Project-Issue description that clearly states:
  - the problem
  - why it matters to the Objective
  - affected milestones or delivery items
  - current blockers or dependencies
  - proposed resolution path

  If mitigation or resolution work is needed, represent it as Tasks.
  If a mitigation Task becomes directly actionable design or code work, decompose that Task into Sub-tasks.
  Child items should follow serial ordering when there is a dependency chain.
  Estimation should be bottom-up from Sub-tasks when present, then aggregated through Tasks.

  Do not treat Project-Issue refinement as complete until the issue is actionable, owned, and its impact on delivery sequencing is clear.',
    '12391',
    'Treat Project-Risk as a project-level risk item for the parent Objective.
  A Project-Risk is used to track uncertainty, exposure, or a possible future problem that could affect delivery, scope, quality, timing, or coordination.

  First, determine whether the Project-Risk is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Research the risk, review the related Objective and sibling milestone-level items, and chat with the user whenever needed to clarify likelihood, impact, triggers, mitigation options, and contingency plans.

  Produce a refined Project-Risk description that clearly states:
  - the risk statement
  - why it matters to the Objective
  - likelihood and impact
  - early warning signs or triggers
  - mitigation and contingency approach

  If mitigation work is needed, represent it as Tasks.
  If a mitigation Task becomes directly actionable design or code work, decompose that Task into Sub-tasks.
  Child items should follow serial ordering when there is a dependency chain.
  Estimation should be bottom-up from Sub-tasks when present, then aggregated through Tasks.

  Do not treat Project-Risk refinement as complete until the risk, its exposure, and the mitigation path are coherent and actionable.',
    '10002',
    'Treat Story as a specification-level delivery item.
  In this seed loop, Story children of an Epic are expected to contain specification work.
  A Story should define the intended behavior, scope, interfaces, acceptance criteria, and delivery constraints clearly enough that implementation Tasks can be created as sibling items under the same parent.

  First, determine whether the Story is clearly defined.
  If the description is missing, unclear, or does not contain enough information to refine, gather the missing context before proceeding.
  Research the Story, review the parent Epic, and chat with the user whenever needed to clarify behavior, boundaries, dependencies, acceptance criteria, and open questions.

  Produce a refined Story description that clearly states:
  - the specification goal
  - the expected behavior or design outcome
  - scope boundaries
  - dependencies and sequencing constraints
  - concrete acceptance criteria

  Story and Task are sibling issue types under Epic or Project-Issue or Project-Risk.
  If implementation work is needed after Story refinement, create Task siblings under the same parent and keep serial ordering across those siblings.
  Story estimates should be maintained directly, and parent-level aggregation should use the bottom-up estimates coming from Task and Sub-task chains.

  Do not treat Story refinement as complete until the Story is clear enough to drive actionable sibling Tasks under the same parent.',
    '10013',
    'Treat Task as a concrete delivery step under Epic, Project-Issue, or Project-Risk when implementation work must be carried out.
  A Task should represent a meaningful unit of work, but if it still spans multiple PRs, multiple design changes, or multiple blocked steps, decompose it further into Sub-tasks.

  First, determine whether the Task is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Research the Task, review the parent item, and clarify dependencies, scope, and acceptance criteria.

  Produce a refined Task description that clearly states:
  - the concrete delivery goal
  - the expected output or change
  - sequencing dependencies
  - acceptance criteria

  If the Task still contains multiple smallest meaningful implementation or design units, decompose it into Sub-tasks.
  Order of child Sub-tasks matters and should reflect serial development.
  Estimation should be bottom-up from child Sub-tasks and aggregated into the Task estimate.

  Do not treat Task refinement as complete until the Task or its Sub-task decomposition is coherent, ordered, and actionable.',
    '10015',
    'Treat Bug as a defect-focused delivery item.
  A Bug should describe incorrect behavior, the expected behavior, impact, scope, and how the defect should be validated.

  First, determine whether the Bug is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Research the defect, review the parent item and related implementation context, and clarify reproduction steps, impact, and acceptance criteria.

  Produce a refined Bug description that clearly states:
  - the observed problem
  - the expected behavior
  - affected scope
  - reproduction or triggering conditions
  - acceptance criteria for the fix

  If the Bug requires staged work, decompose it into the smallest meaningful Sub-tasks.
  Order of child items matters and should reflect serial development when one step blocks the next.
  Estimation should be bottom-up from child items when children exist.

  Do not treat Bug refinement as complete until the defect scope and repair path are coherent and actionable.',
    '10037',
    'Treat Spike as a research or investigation item used to reduce uncertainty before implementation.
  A Spike should answer a specific question, evaluate options, or produce evidence needed for later delivery work.

  First, determine whether the Spike is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Research the Spike goal, review the parent item, and clarify the decision to be supported, the unknowns to resolve, and the expected output.

  Produce a refined Spike description that clearly states:
  - the question or uncertainty being investigated
  - why it matters
  - the scope of investigation
  - the expected output or recommendation
  - exit criteria for closing the Spike

  If the Spike requires multiple steps, decompose it into the smallest meaningful Sub-tasks.
  Order of child items matters and should reflect serial development when one step depends on another.
  Estimation should be bottom-up from child items when children exist.

  Do not treat Spike refinement as complete until the investigation scope and expected outcome are coherent and actionable.',
    '10014',
    'Treat Sub-task as the implementation level for this loop.
  Each code implementation or design work item should be carried out in Sub-tasks.
  A Sub-task is the smallest meaningful level of implementation or design work that is expected to produce PRs or design changes as small as possible for proper iteration.

  First, determine whether the Sub-task is clearly defined.
  If the description is missing, unclear, or does not contain enough information to act, gather the missing context before proceeding.
  Review the parent item and clarify exactly what change should be made, what constraints apply, and how completion will be verified.

  Produce a refined Sub-task description that clearly states:
  - the smallest meaningful implementation or design objective
  - the expected code or design change
  - blocking dependencies on earlier siblings
  - acceptance criteria

  Sub-tasks should not be decomposed further in normal planning.
  Order of Sub-tasks matters and should reflect serial development whenever one change blocks the next.
  Estimation starts at the Sub-task level.
  Parent estimates should be aggregated bottom-up from Sub-task estimates through Tasks, Stories, Epics, and Objectives.

  Do not treat a Sub-task as complete until it is specific enough to drive a small, iterative PR or design change.'
    )
    )
    WHERE "loop" = v_loop_id
      AND "workgraph" = v_workgraph_id;

    -- Seed one default webhook definition for local development if none exists for this loop-workgraph.
    -- Secret value for local testing: athena-local-webhook-secret
    -- Hash algorithm matches webhook.controller.ts (sha256 hex).
    INSERT INTO "webhook" (
      "label",
      "receiverId",
      "type",
      "loopWorkgraph",
      "authHeaderName",
      "authSecretHash",
      "securityMode",
      "securityConfig",
      "active"
    )
    SELECT
      v_webhook_label,
      v_webhook_receiver_id,
      v_webhook_type,
      lw."id",
      v_webhook_auth_header_name,
      v_webhook_auth_secret_hash,
      v_webhook_security_mode,
      v_webhook_security_config,
      TRUE
    FROM "loopWorkgraph" lw
    WHERE lw."loop" = v_loop_id
      AND lw."workgraph" = v_workgraph_id
      AND NOT EXISTS (
        SELECT 1
        FROM "webhook" wh
        WHERE wh."loopWorkgraph" = lw."id"
      );
  END IF;

  INSERT INTO "repository" (
    "id",
    "owner",
    "displayName",
    "repositoryType",
    "apiBaseUrl",
    "repositoryOwner",
    "repositoryName",
    "defaultBranch",
    "credentialCiphertext",
    "credentialIv",
    "credentialAuthTag",
    "credentialKeyVersion",
    "lifecycleStatus"
  )
  VALUES (
    v_repository_id,
    v_user_id,
    v_repository_display_name,
    v_repository_type,
    v_repository_api_base_url,
    v_repository_owner,
    v_repository_name,
    v_repository_default_branch,
    v_repository_credential_ciphertext,
    v_repository_credential_iv,
    v_repository_credential_auth_tag,
    v_repository_credential_key_version,
    v_repository_lifecycle_status
  )
  ON CONFLICT ("owner", "displayName") DO UPDATE
  SET
    "repositoryType" = EXCLUDED."repositoryType",
    "apiBaseUrl" = EXCLUDED."apiBaseUrl",
    "repositoryOwner" = EXCLUDED."repositoryOwner",
    "repositoryName" = EXCLUDED."repositoryName",
    "defaultBranch" = EXCLUDED."defaultBranch",
    "credentialCiphertext" = EXCLUDED."credentialCiphertext",
    "credentialIv" = EXCLUDED."credentialIv",
    "credentialAuthTag" = EXCLUDED."credentialAuthTag",
    "credentialKeyVersion" = EXCLUDED."credentialKeyVersion",
    "lifecycleStatus" = EXCLUDED."lifecycleStatus",
    "updatedAt" = NOW();

  INSERT INTO "loopRepository" ("loop", "repository")
  VALUES (v_loop_id, v_repository_id)
  ON CONFLICT ("loop", "repository") DO NOTHING;

  INSERT INTO "loopRunnerRepository" ("loop", "runner", "repository")
  VALUES (v_loop_id, v_runner_id, v_repository_id)
  ON CONFLICT ("loop", "runner", "repository") DO NOTHING;
END $$;