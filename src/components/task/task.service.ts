import { getPool } from "@components/postgres/postgres.js";
import { TaskClaimLostError } from "./task.errors.js";
import type { Task, TaskCreateInput, TaskInsert, TaskUpdateInput } from "./task.schema.js";
import { taskCreateInputSchema, taskUpdateInputSchema } from "./task.schema.js";

const taskColumnNames = [
  `id`,
  `loop`,
  `phase`,
  `sourceType`,
  `sourceRef`,
  `status`,
  `assignee`,
  `selectedPersona`,
  `targetType`,
  `targetId`,
  `workgraphItem`,
  `routeReasonCode`,
  `routeReasonText`,
  `description`,
  `kind`,
  `successCriteria`,
  `externalRefs`,
  `context`,
  `routing`,
  `emittedByPersona`,
  `blocker`,
  `approvals`,
  `payload`,
  `emittedAt`,
  `completedAt`,
  `claimToken`,
  `claimOwner`,
  `pingedAt`,
  `processingSourceStatus`,
  `claimAttemptCount`,
  `autonomyIterationCount`,
  `autonomyMaxIterations`,
  `llmCostUsdTotal`,
  `updatedAt`,
] as const;

const getTaskColumns = (tableAlias?: string): string => taskColumnNames.map((column) => `${tableAlias ? `${tableAlias}.` : ``}"${column}"`).join(`, `);

const taskInsertSql = `
  INSERT INTO "task" (
    "loop", "phase", "sourceType", "sourceRef", "status", "assignee",
    "selectedPersona", "targetType", "targetId", "workgraphItem", "routeReasonCode", "routeReasonText",
    "description", "kind", "successCriteria", "externalRefs",
    "context", "routing", "emittedByPersona", "blocker", "approvals", "payload",
    "completedAt", "autonomyIterationCount", "autonomyMaxIterations"
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
    $13, $14, $15::jsonb, $16::jsonb,
    $17, $18::jsonb, $19, $20, $21::jsonb, $22::jsonb,
    $23, $24, $25
  )
  RETURNING ${getTaskColumns()}
`;

const buildTaskInsert = (task: TaskCreateInput): TaskInsert => ({
  ...task,
  kind: `other`,
});

const buildTaskInsertParams = (task: TaskInsert): unknown[] => [
  task.loop,
  task.phase,
  task.sourceType,
  task.sourceRef,
  task.status,
  task.assignee,
  task.selectedPersona,
  task.targetType,
  task.targetId,
  task.workgraphItem ?? null,
  task.routeReasonCode,
  task.routeReasonText,
  task.description,
  task.kind,
  JSON.stringify(task.successCriteria),
  JSON.stringify(task.externalRefs),
  task.context,
  JSON.stringify(task.routing),
  task.emittedByPersona,
  task.blocker,
  JSON.stringify(task.approvals),
  JSON.stringify(task.payload),
  task.completedAt,
  task.autonomyIterationCount,
  task.autonomyMaxIterations,
];

type TaskCreateQueryTarget = {
  query: <T>(text: string, params: unknown[]) => Promise<{ rows: T[] }>;
};

const insertTaskRow = async (target: TaskCreateQueryTarget, task: TaskInsert): Promise<Task> => {
  const result = await target.query<Task>(taskInsertSql, buildTaskInsertParams(task));
  const created = result.rows[0];

  if (!created) {
    throw new Error(`Task was not created.`);
  }

  return created;
};

export const queryTaskCreate = async (
  task: TaskCreateInput,
  options?: { workgraphItemId?: string },
): Promise<Task | null> => {
  const v = taskCreateInputSchema.parse(task);
  const taskInsert = buildTaskInsert(v);

  if (!options?.workgraphItemId) {
    return insertTaskRow(getPool(), taskInsert);
  }

  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const lockedItem = await client.query<{ id: string }>(
      `
        SELECT "id"
        FROM "loopWorkgraphItem"
        WHERE "id" = $1::uuid
        FOR UPDATE
      `,
      [options.workgraphItemId],
    );

    if (!lockedItem.rows[0]) {
      await client.query(`ROLLBACK`);
      return null;
    }

    const existingTask = await client.query<{ id: string }>(
      `
        SELECT "id"
        FROM "task"
        WHERE "workgraphItem" = $1::uuid
          AND "status" <> 'completed'
        LIMIT 1
        FOR UPDATE
      `,
      [options.workgraphItemId],
    );

    if (existingTask.rows[0]) {
      await client.query(`COMMIT`);
      return null;
    }

    const createdResult = await insertTaskRow(client, {
      ...taskInsert,
      workgraphItem: options.workgraphItemId,
    });

    await client.query(`COMMIT`);
    return createdResult;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryTaskList = async (userId: string): Promise<Task[]> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${getTaskColumns(`t`)}
      FROM "task" t
      JOIN "loopUser" lu ON lu."loop" = t."loop"
      WHERE lu."user" = $1
      ORDER BY t."emittedAt" DESC
    `,
    [userId],
  );
  return result.rows;
};

export const queryLoopTaskList = async (loopId: string, userId: string): Promise<Task[]> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${getTaskColumns(`t`)}
      FROM "task" t
      JOIN "loopUser" lu ON lu."loop" = t."loop"
      WHERE lu."user" = $1
        AND t."loop" = $2
      ORDER BY t."updatedAt" DESC, t."emittedAt" DESC
    `,
    [userId, loopId],
  );
  return result.rows;
};

export const queryLoopChatUserMessageCount = async (loopId: string): Promise<number> => {
  const result = await getPool().query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "task"
      WHERE "loop" = $1
        AND "sourceType" = 'chat-ui'
        AND "payload"->'chat'->>'messageType' = 'user'
    `,
    [loopId],
  );
  return Number(result.rows[0]?.count ?? `0`);
};

export const queryLoopLastSelectedPersona = async (loopId: string): Promise<string | undefined> => {
  const result = await getPool().query<{ selectedPersona: string | null }>(
    `
      SELECT "selectedPersona"
      FROM "task"
      WHERE "loop" = $1
        AND "sourceType" = 'chat-ui'
        AND "selectedPersona" IS NOT NULL
      ORDER BY "emittedAt" DESC
      LIMIT 1
    `,
    [loopId],
  );
  return result.rows[0]?.selectedPersona ?? undefined;
};

export const queryLoopLatestActiveTask = async (loopId: string, userId: string): Promise<Task | null> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${getTaskColumns(`t`)}
      FROM "task" t
      JOIN "loopUser" lu ON lu."loop" = t."loop"
      WHERE lu."user" = $1
        AND t."loop" = $2
        AND t."sourceType" = 'chat-ui'
        AND t."status" NOT IN ('completed')
      ORDER BY t."updatedAt" DESC
      LIMIT 1
    `,
    [userId, loopId],
  );
  return result.rows[0] ?? null;
};

export const queryLoopLatestTask = async (loopId: string, userId: string): Promise<Task | null> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${getTaskColumns(`t`)}
      FROM "task" t
      JOIN "loopUser" lu ON lu."loop" = t."loop"
      WHERE lu."user" = $1
        AND t."loop" = $2
        AND t."sourceType" = 'chat-ui'
      ORDER BY t."updatedAt" DESC
      LIMIT 1
    `,
    [userId, loopId],
  );
  return result.rows[0] ?? null;
};

export const queryTaskById = async (taskId: string): Promise<Task | null> => {
  const result = await getPool().query<Task>(`SELECT ${getTaskColumns()} FROM "task" WHERE "id" = $1 LIMIT 1`, [taskId]);
  return result.rows[0] ?? null;
};

const processableClaimCondition = `
  (
    ("phase" = 'routing' AND "status" = 'active')
    OR ("phase" = 'execution' AND "status" IN ('queued', 'blocked'))
    OR (
      "status" = 'processing'
      AND (
        "pingedAt" IS NULL
        OR "pingedAt" <= NOW() - ($2 * INTERVAL '1 second')
      )
    )
  )
`;
const reclaimStaleSeconds = 120;

export const queryNextProcessableTask = async (claimOwner: string): Promise<Task | null> => {
  const claimedTasks = await queryClaimedTasks(1, claimOwner);
  return claimedTasks[0] ?? null;
};

export const queryLoopsWithPoolNotReadyTasks = async (): Promise<string[]> => {
  const result = await getPool().query<{ loop: string }>(`SELECT DISTINCT "loop" FROM "task" WHERE "status" = 'pool-not-ready'`);
  return result.rows.map((row) => row.loop);
};

export const queryPromotePoolNotReadyTasksToQueued = async (loopId: string): Promise<number> => {
  const result = await getPool().query(
    `
      UPDATE "task"
      SET "phase" = 'execution', "status" = 'queued', "updatedAt" = NOW()
      WHERE "loop" = $1 AND "status" = 'pool-not-ready'
    `,
    [loopId],
  );
  return Number(result.rowCount ?? 0);
};

const queryClaimedTasks = async (limit: number, claimOwner: string): Promise<Task[]> => {
  const client = await getPool().connect();
  try {
    await client.query(`BEGIN`);

    const lockedRows = await client.query<{ id: string }>(
      `
        SELECT "id" FROM "task"
        WHERE ${processableClaimCondition}
        ORDER BY "updatedAt" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit, reclaimStaleSeconds],
    );

    const ids = lockedRows.rows.map((row) => row.id);
    if (ids.length === 0) {
      await client.query(`COMMIT`);
      return [];
    }

    const claimedResult = await client.query<Task>(
      `
        UPDATE "task"
        SET
          "status" = 'processing',
          "processingSourceStatus" = CASE
            WHEN "status" = 'processing' THEN COALESCE("processingSourceStatus", 'queued')
            ELSE "status"
          END,
          "claimToken" = uuidv7(),
          "claimOwner" = $2,
          "pingedAt" = NOW(),
          "claimAttemptCount" = "claimAttemptCount" + 1
        WHERE "id" = ANY($1::uuid[])
        RETURNING ${getTaskColumns()}
      `,
      [ids, claimOwner],
    );

    await client.query(`COMMIT`);
    const claimedById = new Map(claimedResult.rows.map((t) => [t.id, t]));
    return ids.map((id) => claimedById.get(id)).filter((t): t is Task => t !== undefined);
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryTaskPing = async (taskId: string, claimToken: string): Promise<boolean> => {
  const result = await getPool().query<{ id: string }>(
    `
      UPDATE "task" SET "pingedAt" = NOW()
      WHERE "id" = $1 AND "status" = 'processing' AND "claimToken" = $2::uuid
      RETURNING "id"
    `,
    [taskId, claimToken],
  );
  return result.rowCount === 1;
};

export const queryTaskByIdForUser = async (taskId: string, userId: string): Promise<Task | null> => {
  const result = await getPool().query<Task>(
    `
      SELECT ${getTaskColumns(`t`)}
      FROM "task" t
      JOIN "loopUser" lu ON lu."loop" = t."loop"
      WHERE lu."user" = $1 AND t."id" = $2
      LIMIT 1
    `,
    [userId, taskId],
  );
  return result.rows[0] ?? null;
};

export const queryTaskUpdate = async (input: TaskUpdateInput): Promise<Task> => {
  const validatedInput = taskUpdateInputSchema.parse(input);
  const currentResult = await getPool().query<Task>(`SELECT ${getTaskColumns()} FROM "task" WHERE "id" = $1 LIMIT 1`, [validatedInput.id]);
  const current = currentResult.rows[0];
  if (!current) throw new Error(`Task not found for update.`);

  const result = await getPool().query<Task>(
    `
      UPDATE "task"
      SET
        "phase" = $2,
        "status" = $3,
        "assignee" = $4,
        "selectedPersona" = $5,
        "targetType" = $6,
        "targetId" = $7,
        "routeReasonCode" = $8,
        "routeReasonText" = $9,
        "blocker" = $10,
        "payload" = $11::jsonb,
        "context" = $12,
        "completedAt" = $13,
        "claimToken" = $14::uuid,
        "claimOwner" = $15,
        "pingedAt" = $16,
        "processingSourceStatus" = $17,
        "autonomyIterationCount" = $19,
        "autonomyMaxIterations" = $20,
        "llmCostUsdTotal" = $21,
        "updatedAt" = NOW()
      WHERE "id" = $1
        AND ($18::uuid IS NULL OR "claimToken" = $18::uuid)
      RETURNING ${getTaskColumns()}
    `,
    [
      validatedInput.id,
      validatedInput.phase ?? current.phase,
      validatedInput.status ?? current.status,
      validatedInput.assignee === undefined ? current.assignee : validatedInput.assignee,
      validatedInput.selectedPersona === undefined ? current.selectedPersona : validatedInput.selectedPersona,
      validatedInput.targetType === undefined ? current.targetType : validatedInput.targetType,
      validatedInput.targetId === undefined ? current.targetId : validatedInput.targetId,
      validatedInput.routeReasonCode === undefined ? current.routeReasonCode : validatedInput.routeReasonCode,
      validatedInput.routeReasonText === undefined ? current.routeReasonText : validatedInput.routeReasonText,
      validatedInput.blocker === undefined ? current.blocker : validatedInput.blocker,
      JSON.stringify(validatedInput.payload ?? current.payload),
      validatedInput.context ?? current.context,
      validatedInput.completedAt === undefined ? current.completedAt : validatedInput.completedAt,
      validatedInput.clearClaim ? null : current.claimToken,
      validatedInput.clearClaim ? null : current.claimOwner,
      validatedInput.clearClaim ? null : current.pingedAt,
      validatedInput.clearClaim ? null : current.processingSourceStatus,
      validatedInput.expectedClaimToken ?? null,
      validatedInput.autonomyIterationCount ?? current.autonomyIterationCount,
      validatedInput.autonomyMaxIterations ?? current.autonomyMaxIterations,
      validatedInput.llmCostUsdTotal ?? current.llmCostUsdTotal,
    ],
  );

  const updated = result.rows[0];
  if (!updated) {
    if (validatedInput.expectedClaimToken) {
      throw new TaskClaimLostError(`Claim token mismatch while updating task.`);
    }
    throw new Error(`Task was not updated.`);
  }
  return updated;
};
