import { pgColumns } from "@components/postgres/pg.utilities.js";
import { getPool, type QueryExecutor, query } from "@components/postgres/postgres.js";
import type { RunnerQueueItem } from "./runner.schema.js";

const runnerQueueColumnNames = [`id`, `loop`, `task`, `runner`, `repository`, `prompt`, `plan`, `status`, `claimedBy`, `claimedAt`, `consumerPingedAt`, `externalTaskId`, `result`, `error`, `createdAt`, `updatedAt`] as const;
const runnerQueueColumns = pgColumns(runnerQueueColumnNames, `rq`);
const runnerQueueColumnsUnscoped = pgColumns(runnerQueueColumnNames);

export const queryRunnerQueueCreate = async (loopId: string, taskId: string, runnerId: string, repository: string, prompt: string, plan: string, executor: QueryExecutor = { query }): Promise<RunnerQueueItem> => {
  const result = await executor.query<RunnerQueueItem>(
    `
      INSERT INTO "runnerQueue" ("loop", "task", "runner", "repository", "prompt", "plan")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${runnerQueueColumnsUnscoped}
    `,
    [loopId, taskId, runnerId, repository, prompt, plan],
  );

  const item = result.rows[0];

  if (!item) {
    throw new Error(`Runner queue item was not created.`);
  }

  console.log(`[runner-queue-service] item created`, { id: item.id, loopId, taskId, runnerId, repository });
  return item;
};

export const queryRunnerQueueById = async (id: string): Promise<RunnerQueueItem | undefined> => {
  const result = await query<RunnerQueueItem>(`SELECT ${runnerQueueColumnsUnscoped} FROM "runnerQueue" WHERE "id" = $1`, [id]);
  return result.rows[0];
};

export const queryRunnerQueueListActiveByRunnerType = async (runnerType: string): Promise<RunnerQueueItem[]> => {
  const result = await query<RunnerQueueItem>(
    `
      SELECT ${runnerQueueColumns}
      FROM "runnerQueue" rq
      JOIN "runner" r ON r."id" = rq."runner"
      WHERE rq."status" IN ('pending', 'claimed')
        AND r."type" = $1
      ORDER BY rq."createdAt" ASC
    `,
    [runnerType],
  );

  return result.rows;
};

export const queryRunnerQueueMarkSubmitting = async (id: string): Promise<boolean> => {
  const result = await query(`UPDATE "runnerQueue" SET "status" = 'claimed' WHERE "id" = $1 AND "status" = 'pending' AND "externalTaskId" IS NULL`, [id]);
  return Boolean(result.rowCount);
};

export const queryRunnerQueueStoreExternalTaskId = async (id: string, externalTaskId: string): Promise<boolean> => {
  const result = await query(`UPDATE "runnerQueue" SET "externalTaskId" = $2 WHERE "id" = $1 AND "status" = 'claimed' AND "externalTaskId" IS NULL`, [id, externalTaskId]);
  return Boolean(result.rowCount);
};

export const queryRunnerQueueFinalize = async (id: string, status: `completed` | `failed`, detail: string, taskMessage: string): Promise<boolean> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const itemResult = await client.query<{ task: string; status: string }>(`SELECT "task", "status" FROM "runnerQueue" WHERE "id" = $1 FOR UPDATE`, [id]);
    const item = itemResult.rows[0];

    if (!item || item.status === `completed` || item.status === `failed`) {
      await client.query(`COMMIT`);
      return false;
    }

    await client.query(`UPDATE "runnerQueue" SET "status" = $2, "result" = CASE WHEN $2 = 'completed' THEN $3 ELSE "result" END, "error" = CASE WHEN $2 = 'failed' THEN $3 ELSE "error" END WHERE "id" = $1`, [id, status, detail]);
    await client.query(
      `
        UPDATE "task"
        SET
          "queue" = CASE
            WHEN EXISTS (SELECT 1 FROM jsonb_array_elements("queue") item WHERE item->>'id' = $2::text)
              THEN "queue"
            ELSE "queue" || jsonb_build_array(jsonb_build_object(
              'type', 'message',
              'id', $2::text,
              'status', 'pending',
              'timestamp', to_jsonb(clock_timestamp()),
              'value', jsonb_build_object('role', 'user', 'content', $3::text)
            ))
          END,
          "status" = CASE WHEN "status" = 'completed' THEN 'queued' ELSE "status" END
        WHERE "id" = $1
      `,
      [item.task, id, taskMessage],
    );
    await client.query(`COMMIT`);
    return true;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

// Atomically claims the oldest pending item for a given runner type.
export const queryRunnerQueueClaimNext = async (runnerType: string, consumerId: string): Promise<RunnerQueueItem | undefined> => {
  const result = await query<RunnerQueueItem>(
    `
      WITH next_item AS (
        SELECT rq."id"
        FROM "runnerQueue" rq
        JOIN "runner" r ON r."id" = rq."runner"
        WHERE rq."status" = 'pending'
          AND r."type" = $1
        ORDER BY rq."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "runnerQueue" rq
      SET "status" = 'claimed',
          "claimedBy" = $2,
          "claimedAt" = NOW(),
          "consumerPingedAt" = NOW()
      FROM next_item
      WHERE rq."id" = next_item."id"
      RETURNING ${runnerQueueColumns}
    `,
    [runnerType, consumerId],
  );

  const item = result.rows[0];

  if (item) {
    console.log(`[runner-queue-service] item claimed`, { id: item.id, runnerType, consumerId });
  }

  return item;
};

// Lists all claimed items for this consumer so the cycle can poll their external status.
export const queryRunnerQueueListClaimed = async (consumerId: string): Promise<RunnerQueueItem[]> => {
  const result = await query<RunnerQueueItem>(
    `
      SELECT ${runnerQueueColumnsUnscoped}
      FROM "runnerQueue"
      WHERE "status" = 'claimed'
        AND "claimedBy" = $1
      ORDER BY "claimedAt" ASC
    `,
    [consumerId],
  );

  return result.rows;
};

export const queryRunnerQueuePingClaims = async (consumerId: string): Promise<void> => {
  await query(
    `
      UPDATE "runnerQueue"
      SET "consumerPingedAt" = NOW()
      WHERE "status" = 'claimed'
        AND "claimedBy" = $1
    `,
    [consumerId],
  );
};

export const queryRunnerQueueReclaimStaleClaims = async (consumerId: string): Promise<RunnerQueueItem[]> => {
  const result = await query<RunnerQueueItem>(
    `
      UPDATE "runnerQueue"
      SET "claimedBy" = $1,
          "consumerPingedAt" = NOW()
      WHERE "status" = 'claimed'
        AND (
          "consumerPingedAt" < NOW() - INTERVAL '5 minutes'
          OR "consumerPingedAt" IS NULL
        )
      RETURNING ${runnerQueueColumnsUnscoped}
    `,
    [consumerId],
  );

  return result.rows;
};

export const queryRunnerQueueSetExternalTaskId = async (id: string, consumerId: string, externalTaskId: string): Promise<boolean> => {
  const result = await query(
    `
      UPDATE "runnerQueue"
      SET "externalTaskId" = $3
      WHERE "id" = $1
        AND "claimedBy" = $2
        AND "status" = 'claimed'
    `,
    [id, consumerId, externalTaskId],
  );

  const updated = (result.rowCount ?? 0) > 0;
  console.log(`[runner-queue-service] external task id set`, { id, externalTaskId, updated });
  return updated;
};

export const queryRunnerQueueSubmitResult = async (id: string, consumerId: string, result: string): Promise<boolean> => {
  const dbResult = await query(
    `
      UPDATE "runnerQueue"
      SET "status" = 'completed',
          "result" = $3
      WHERE "id" = $1
        AND "claimedBy" = $2
        AND "status" = 'claimed'
    `,
    [id, consumerId, result],
  );

  const updated = (dbResult.rowCount ?? 0) > 0;
  console.log(`[runner-queue-service] result submitted`, { id, consumerId, updated });
  return updated;
};

export const queryRunnerQueueMarkFailed = async (id: string, consumerId: string, error: string): Promise<boolean> => {
  const result = await query(
    `
      UPDATE "runnerQueue"
      SET "status" = 'failed',
          "error" = $3
      WHERE "id" = $1
        AND "claimedBy" = $2
        AND "status" = 'claimed'
    `,
    [id, consumerId, error],
  );

  const updated = (result.rowCount ?? 0) > 0;
  console.log(`[runner-queue-service] item mark-failed`, { id, consumerId, updated });
  return updated;
};

export const queryRunnerQueueListByRunner = async (runnerId: string): Promise<RunnerQueueItem[]> => {
  const result = await query<RunnerQueueItem>(
    `
      SELECT ${runnerQueueColumnsUnscoped}
      FROM "runnerQueue"
      WHERE "runner" = $1
      ORDER BY "createdAt" DESC
    `,
    [runnerId],
  );

  return result.rows;
};

export const queryRunnerQueueListByLoop = async (loopId: string): Promise<RunnerQueueItem[]> => {
  const result = await query<RunnerQueueItem>(
    `
      SELECT ${runnerQueueColumnsUnscoped}
      FROM "runnerQueue"
      WHERE "loop" = $1
      ORDER BY "createdAt" DESC
    `,
    [loopId],
  );

  return result.rows;
};
