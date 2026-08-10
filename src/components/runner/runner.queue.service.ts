import { getPool } from "@components/postgres/postgres.js";
import type { RunnerQueueItem } from "./runner.schema.js";

const runnerQueueColumns = `"id", "loop", "task", "runner", "prompt", "plan", "status", "claimedBy", "claimedAt", "result", "error", "createdAt", "updatedAt"`;

export const queryRunnerQueueCreate = async (loopId: string, taskId: string, runnerId: string, prompt: string, plan: string): Promise<RunnerQueueItem> => {
  const result = await getPool().query<RunnerQueueItem>(
    `
      INSERT INTO "runnerQueue" ("loop", "task", "runner", "prompt", "plan")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${runnerQueueColumns}
    `,
    [loopId, taskId, runnerId, prompt, plan],
  );

  const item = result.rows[0];

  if (!item) {
    throw new Error(`Runner queue item was not created.`);
  }

  console.log(`[runner-queue-service] item created`, { id: item.id, loopId, taskId, runnerId });
  return item;
};

// Atomically claims the oldest pending item for a given runner type.
export const queryRunnerQueueClaimNext = async (runnerType: string, consumerId: string): Promise<RunnerQueueItem | undefined> => {
  const result = await getPool().query<RunnerQueueItem>(
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
      RETURNING rq."id", rq."loop", rq."task", rq."runner", rq."prompt", rq."plan", rq."status", rq."claimedBy", rq."claimedAt", rq."result", rq."error", rq."createdAt", rq."updatedAt"
    `,
    [runnerType, consumerId],
  );

  const item = result.rows[0];

  if (item) {
    console.log(`[runner-queue-service] item claimed`, { id: item.id, runnerType, consumerId });
  }

  return item;
};

export const queryRunnerQueueMarkFailed = async (id: string, consumerId: string, error: string): Promise<boolean> => {
  const result = await getPool().query(
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
