import { getPool } from "@components/postgres/postgres.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { v7 as uuidv7 } from "uuid";
import type { Task, TaskCreate, TaskQueueItemInput } from "./task.schema.js";
import { taskCreateSchema } from "./task.schema.js";

const taskColumnNames = ["id", "loop", "currentPersona", "currentProvider", "currentModel", "source", "status", "processorUnit", "processorPingedAt", "workgraphItem", "title", "queue", "createdAt", "updatedAt"] as const;

const taskColumns = taskColumnNames.map((column) => `"${column}"`).join(`, `);

const scopeTaskColumns = (scope: string): string => {
  return taskColumnNames.map((column) => `${scope}."${column}"`).join(`, `);
};

export const queryTaskList = async (loopId: string): Promise<Task[]> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${taskColumns}
      FROM "task"
      WHERE "loop" = $1
      ORDER BY "id" DESC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryTaskGet = async (loopId: string, taskId: string): Promise<Task | null> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${taskColumns}
      FROM "task"
      WHERE "loop" = $1
        AND "id" = $2
      LIMIT 1
    `,
    [loopId, taskId],
  );

  return result.rows[0] ?? null;
};

export const queryTaskListByWorkgraphItem = async (loopId: string, workgraphItemId: string): Promise<Task[]> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${taskColumns}
      FROM "task"
      WHERE "loop" = $1
        AND "workgraphItem" = $2
      ORDER BY "createdAt" DESC
    `,
    [loopId, workgraphItemId],
  );

  return result.rows;
};

export const queryTaskCreate = async (input: TaskCreate): Promise<Task> => {
  const task = taskCreateSchema.parse(input);
  const result = await getPool().query<Task>(
    `
      INSERT INTO "task" ("loop", "source", "status", "workgraphItem", "title")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${taskColumns}
    `,
    [task.loop, task.source ?? `user`, task.status ?? `queued`, task.workgraphItem ?? null, task.title ?? `New Task`],
  );

  const createdTask = result.rows[0];

  if (!createdTask) {
    throw new Error(`Task was not created.`);
  }

  return createdTask;
};

export const queryTaskCreateForWorkgraphItem = async (input: { loop: string; workgraphItem: string; title?: string | null }): Promise<Task | null> => {
  const result = await getPool().query<Task>(
    `
      WITH lock_row AS (
        SELECT pg_advisory_xact_lock(hashtext(($2::uuid)::text))
      ),
      inserted AS (
        INSERT INTO "task" ("loop", "source", "status", "workgraphItem", "title")
        SELECT
          $1::uuid,
          'workgraphItem',
          'queued',
          $2::uuid,
          COALESCE(NULLIF(BTRIM($3), ''), 'New Task')
        FROM lock_row
        WHERE NOT EXISTS (
          SELECT 1
          FROM "task" t
          WHERE t."loop" = $1::uuid
            AND t."workgraphItem" = $2::uuid
            AND t."status" <> 'completed'
        )
        RETURNING ${taskColumns}
      )
      SELECT ${taskColumns}
      FROM inserted
      LIMIT 1
    `,
    [input.loop, input.workgraphItem, input.title ?? null],
  );

  return result.rows[0] ?? null;
};

export const queryTaskAssignWorkgraphItem = async (loopId: string, taskId: string, workgraphItemId: string, title: string | null): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "task"
      SET
        "source" = 'workgraphItem',
        "workgraphItem" = $3,
        "title" = COALESCE(NULLIF(BTRIM($4), ''), "title")
      WHERE "loop" = $1
        AND "id" = $2
    `,
    [loopId, taskId, workgraphItemId, title ?? null],
  );

  return (result.rowCount ?? 0) > 0;
};

const parseTypeInstructions = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((accumulator, [key, instruction]) => {
    if (typeof instruction === `string` && instruction.trim().length > 0) {
      accumulator[key] = instruction.trim();
    }

    return accumulator;
  }, {});
};

const readSourceIssueTypeIdFromPayload = (value: unknown): string | null => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const fields = payload.fields;

  if (!fields || typeof fields !== `object` || Array.isArray(fields)) {
    return null;
  }

  const issueType = (fields as Record<string, unknown>).issuetype;

  if (!issueType || typeof issueType !== `object` || Array.isArray(issueType)) {
    return null;
  }

  const issueTypeId = (issueType as Record<string, unknown>).id;

  return typeof issueTypeId === `string` && issueTypeId.trim().length > 0 ? issueTypeId.trim() : null;
};

export type TaskWorkgraphItemContext = {
  workgraph: string;
  workgraphItem: string;
  itemType: string;
  sourceIssueTypeId: string | null;
  workOnLabel: string;
  workInProgressLabel: string;
  workDoneLabel: string;
  typeInstructions: Record<string, string>;
};

export const queryTaskWorkgraphItemContext = async (loopId: string, taskId: string): Promise<TaskWorkgraphItemContext | null> => {
  const result = await getPool().query<{
    workgraph: string;
    workgraphItem: string;
    itemType: string;
    payload: unknown;
    assignmentConfig: unknown;
  }>(
    `
      SELECT
        lw."workgraph" AS "workgraph",
        lwi."id" AS "workgraphItem",
        lwi."itemType" AS "itemType",
        lwi."payload" AS "payload",
        lw."assignmentConfig" AS "assignmentConfig"
      FROM "task" t
      JOIN "loopWorkgraphItem" lwi ON lwi."id" = t."workgraphItem"
      JOIN "loopWorkgraph" lw ON lw."id" = lwi."loopWorkgraph"
      WHERE t."loop" = $1
        AND t."id" = $2
      LIMIT 1
    `,
    [loopId, taskId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const assignmentConfig = row.assignmentConfig && typeof row.assignmentConfig === `object` && !Array.isArray(row.assignmentConfig) ? (row.assignmentConfig as Record<string, unknown>) : {};

  return {
    workgraph: row.workgraph,
    workgraphItem: row.workgraphItem,
    itemType: row.itemType,
    sourceIssueTypeId: readSourceIssueTypeIdFromPayload(row.payload),
    workOnLabel: readWorkOnLabelFromAssignmentConfig(assignmentConfig),
    workInProgressLabel: readWorkInProgressLabelFromAssignmentConfig(assignmentConfig),
    workDoneLabel: readWorkDoneLabelFromAssignmentConfig(assignmentConfig),
    typeInstructions: parseTypeInstructions(assignmentConfig.typeInstructions),
  };
};

export const queryTaskPick = async (processorId: string, readyLoopIds: string[]): Promise<Task | null> => {
  if (readyLoopIds.length === 0) {
    return null;
  }

  const result = await getPool().query<Task>(
    `
      WITH picked AS (
        SELECT t."id"
        FROM "task" t
        WHERE t."status" <> 'completed'
          AND t."processorUnit" IS NULL
          AND t."loop" = ANY($2::uuid[])
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(t."queue") AS queue_item
            WHERE queue_item->>'status' = 'awaiting-approval'
          )
        ORDER BY t."createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "task" t
      SET "processorUnit" = $1,
          "status" = 'wip',
          "processorPingedAt" = NOW()
      FROM picked
      WHERE t."id" = picked."id"
      RETURNING ${scopeTaskColumns(`t`)}
    `,
    [processorId, readyLoopIds],
  );

  return result.rows[0] ?? null;
};

export const queryTaskProcessorPing = async (taskId: string, processorId: string): Promise<void> => {
  await getPool().query(
    `
      UPDATE "task"
      SET "processorPingedAt" = NOW()
      WHERE "id" = $1
        AND "processorUnit" = $2
    `,
    [taskId, processorId],
  );
};

export const queryTaskResetStaleProcessorClaims = async (): Promise<number> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "processorUnit" = NULL,
          "processorPingedAt" = NULL,
          "status" = 'queued'
      WHERE t."status" <> 'completed'
        AND t."processorUnit" IS NOT NULL
        AND t."processorPingedAt" < NOW() - INTERVAL '5 minutes'
    `,
  );

  return result.rowCount ?? 0;
};

export const queryTaskResetProcessorClaim = async (loopId: string, taskId: string): Promise<number> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "processorUnit" = NULL,
          "processorPingedAt" = NULL,
          "status" = CASE WHEN t."status" = 'completed' THEN t."status" ELSE 'queued' END
      WHERE t."loop" = $1
        AND t."id" = $2
        AND t."processorUnit" IS NOT NULL
    `,
    [loopId, taskId],
  );

  return result.rowCount ?? 0;
};

export const queryTaskMarkCompleted = async (loopId: string, taskId: string, processorId: string, checkQueueItems = true): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "status" = 'completed'
      WHERE t."loop" = $1
        AND t."id" = $2
        AND t."processorUnit" = $3
        AND (
          NOT $4::boolean
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(t."queue") AS queue_item
            WHERE COALESCE(queue_item->>'status', '') <> 'completed'
          )
        )
    `,
    [loopId, taskId, processorId, checkQueueItems],
  );

  return (result.rowCount ?? 0) > 0;
};

export const queryTaskAssignCurrentPersona = async (loopId: string, taskId: string, processorId: string): Promise<string | null> => {
  const result = await getPool().query<{ currentPersona: string }>(
    `
      WITH routing AS (
        SELECT p."id"
        FROM "loopPersona" lp
        JOIN "persona" p ON p."id" = lp."persona"
        WHERE lp."loop" = $1
          AND p."lifecycleStatus" = 'active'
          AND p."isRouting" = TRUE
        ORDER BY p."createdAt" ASC
        LIMIT 1
      )
      UPDATE "task" t
      SET "currentPersona" = routing."id"
      FROM routing
      WHERE t."loop" = $1
        AND t."id" = $2
        AND t."processorUnit" = $3
        AND t."currentPersona" IS NULL
      RETURNING t."currentPersona"
    `,
    [loopId, taskId, processorId],
  );

  return result.rows[0]?.currentPersona ?? null;
};

export const queryTaskAssignCurrentProvider = async (loopId: string, taskId: string, processorId: string, providerId: string): Promise<string | null> => {
  const result = await getPool().query<{ currentProvider: string }>(
    `
      UPDATE "task" t
      SET "currentProvider" = $4,
          "currentModel" = NULL
      WHERE t."loop" = $1
        AND t."id" = $2
        AND t."processorUnit" = $3
        AND t."currentProvider" IS NULL
      RETURNING t."currentProvider"
    `,
    [loopId, taskId, processorId, providerId],
  );

  return result.rows[0]?.currentProvider ?? null;
};

export const queryTaskAssignCurrentModel = async (loopId: string, taskId: string, processorId: string, providerId: string): Promise<string | null> => {
  const result = await getPool().query<{ currentModel: string }>(
    `
      WITH selected_model AS (
        SELECT COALESCE(NULLIF(BTRIM(p."defaultModel"), ''), p."enabledModels"[1]) AS "model"
        FROM "provider" p
        JOIN "loopProvider" lp ON lp."provider" = p."id"
        WHERE lp."loop" = $1
          AND lp."provider" = $4
          AND lp."enabled" = TRUE
          AND p."lifecycleStatus" = 'active'
          AND p."providerType" = 'openrouter'
        LIMIT 1
      )
      UPDATE "task" t
      SET "currentModel" = selected_model."model"
      FROM selected_model
      WHERE t."loop" = $1
        AND t."id" = $2
        AND t."processorUnit" = $3
        AND t."currentProvider" = $4
        AND t."currentModel" IS NULL
        AND selected_model."model" IS NOT NULL
      RETURNING t."currentModel"
    `,
    [loopId, taskId, processorId, providerId],
  );

  return result.rows[0]?.currentModel ?? null;
};

export const queryAppendQueueItem = async (taskId: string, processorId: string | null, queueItem: TaskQueueItemInput, requeueIfCompleted = false): Promise<boolean> => {
  const itemWithId = { ...queueItem, id: uuidv7() };
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "queue" = t."queue" || CASE
            WHEN COALESCE($3::jsonb #>> '{value,role}', '') <> 'user' THEN jsonb_build_array(
              (
                (
                  $3::jsonb
                  || jsonb_build_object('persona', to_jsonb(t."currentPersona"))
                )
                || jsonb_build_object('timestamp', to_jsonb(clock_timestamp()))
              )
            )
            ELSE jsonb_build_array(($3::jsonb || jsonb_build_object('timestamp', to_jsonb(clock_timestamp()))))
          END,
          "status" = CASE WHEN $4::boolean AND t."status" = 'completed' THEN 'queued' ELSE t."status" END
      WHERE t."id" = $1
        AND ((t."processorUnit" IS NULL AND $2::uuid IS NULL) OR t."processorUnit" = $2::uuid)
    `,
    [taskId, processorId, JSON.stringify(itemWithId), requeueIfCompleted],
  );

  return (result.rowCount ?? 0) > 0;
};

export const queryTaskQueueItemStatusUpdate = async (taskId: string, processorId: string, id: string, status: TaskQueueItemInput["status"]): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "queue" = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN queue_item.item->>'id' = $3 THEN jsonb_set(queue_item.item, '{status}', to_jsonb($4::text), false)
              ELSE queue_item.item
            END
            ORDER BY queue_item.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(t."queue") WITH ORDINALITY AS queue_item(item, ordinality)
      )
      WHERE t."id" = $1
        AND t."processorUnit" = $2
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t."queue") AS queue_item(item)
          WHERE queue_item.item->>'id' = $3
            AND COALESCE(queue_item.item->>'status', '') <> $4
        )
    `,
    [taskId, processorId, id, status],
  );

  return (result.rowCount ?? 0) > 0;
};

// Approve: moves awaiting-approval → approved so the processor can execute the tool calls.
export const queryTaskToolCallApprove = async (loopId: string, taskId: string, queueItemId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "queue" = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN queue_item.item->>'id' = $3
                AND queue_item.item->>'status' = 'awaiting-approval'
              THEN jsonb_set(queue_item.item, '{status}', '"approved"', false)
              ELSE queue_item.item
            END
            ORDER BY queue_item.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(t."queue") WITH ORDINALITY AS queue_item(item, ordinality)
      )
      WHERE t."loop" = $1
        AND t."id" = $2
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t."queue") AS qi(item)
          WHERE qi.item->>'id' = $3
            AND qi.item->>'status' = 'awaiting-approval'
        )
    `,
    [loopId, taskId, queueItemId],
  );

  return (result.rowCount ?? 0) > 0;
};

// Reject: moves awaiting-approval → completed and appends a rejection tool response for each tool call.
export const queryTaskToolCallReject = async (loopId: string, taskId: string, queueItemId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "task" t
      SET "queue" = (
        WITH source AS (
          SELECT queue_item.item, queue_item.ordinality
          FROM jsonb_array_elements(t."queue") WITH ORDINALITY AS queue_item(item, ordinality)
        ),
        target AS (
          SELECT item
          FROM source
          WHERE item->>'id' = $3
            AND item->>'status' = 'awaiting-approval'
          LIMIT 1
        ),
        tool_rejections AS (
          SELECT jsonb_build_object(
            'type', 'message',
            'id', gen_random_uuid()::text,
            'status', 'completed',
            'timestamp', to_jsonb(clock_timestamp()),
            'value', jsonb_build_object(
              'role', 'tool',
              'content', '"Tool call rejected by user."',
              'tool_call_id', tc->>'id',
              'name', tc->'function'->>'name'
            )
          ) AS item
          FROM target, jsonb_array_elements(target.item->'value'->'tool_calls') AS tc
        )
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN source.item->>'id' = $3
                AND source.item->>'status' = 'awaiting-approval'
              THEN jsonb_set(source.item, '{status}', '"completed"', false)
              ELSE source.item
            END
            ORDER BY source.ordinality
          ),
          '[]'::jsonb
        ) || COALESCE((SELECT jsonb_agg(item) FROM tool_rejections), '[]'::jsonb)
        FROM source
      )
      WHERE t."loop" = $1
        AND t."id" = $2
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t."queue") AS qi(item)
          WHERE qi.item->>'id' = $3
            AND qi.item->>'status' = 'awaiting-approval'
        )
    `,
    [loopId, taskId, queueItemId],
  );

  return (result.rowCount ?? 0) > 0;
};
