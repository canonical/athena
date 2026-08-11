import { pgColumns } from "@components/postgres/pg.utilities.js";
import { query } from "@components/postgres/postgres.js";
import type { RunnerQueueItem } from "./runner.schema.js";

const runnerQueueColumnNames = [`id`, `loop`, `task`, `runner`, `repository`, `prompt`, `plan`, `status`, `claimedBy`, `claimedAt`, `externalTaskId`, `result`, `error`, `createdAt`, `updatedAt`] as const;
const runnerQueueColumns = pgColumns(runnerQueueColumnNames, `rq`);
const runnerQueueColumnsUnscoped = pgColumns(runnerQueueColumnNames);

export const queryRunnerQueueCreate = async (loopId: string, taskId: string, runnerId: string, repository: string, prompt: string, plan: string): Promise<RunnerQueueItem> => {
  const result = await query<RunnerQueueItem>(
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

// Atomically claims the oldest pending item for a given runner type.
export const queryRunnerQueueClaimNext = async (runnerType: string, consumerId: string): Promise<RunnerQueueItem | undefined> => {
  const result = await query<RunnerQueueItem>(
    `
      WITH next_item AS (
        SELECT rq."id"
        FROM "runnerQueue" rq
        JOIN "runner" r ON r."id" = rq."runner"
        WHERE rq."status" = 'pending'
          AND r."runnerType" = $1
        ORDER BY rq."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "runnerQueue" rq
      SET "status" = 'claimed',
          "claimedBy" = $2,
          "claimedAt" = NOW()
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
