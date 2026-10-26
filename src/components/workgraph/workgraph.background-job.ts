import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import type { BackgroundJobDefinition, BackgroundJobEnqueueResult } from "@components/background-job/background-job.schema.js";
import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { getPool } from "@components/postgres/postgres.js";
import { z } from "zod";
import { queryLoopWorkgraphMarkSyncFailed, queryLoopWorkgraphMarkSynchronizing, queryWebhookByReceiverId } from "./workgraph.pg.service.js";
import { synchronizeLoopWorkgraphAndPromoteTasks } from "./workgraph.sync.service.js";

const workgraphSyncPayloadSchema = z.object({
  loopId: z.uuid(),
  workgraphId: z.uuid(),
  receiverId: z.string().min(1).optional(),
});

type WorkgraphSyncPayload = z.infer<typeof workgraphSyncPayloadSchema>;

const workgraphSyncJobDefinition: BackgroundJobDefinition<WorkgraphSyncPayload, { syncedCount: number; createdTaskCount: number; skipped: boolean }> = {
  name: `workgraph.sync`,
  version: 1,
  payloadSchema: workgraphSyncPayloadSchema,
  queue: { policy: `stately` },
  worker: { localConcurrency: 1 },
  handler: async ({ payload }) => {
    if (payload.receiverId) {
      const webhook = await queryWebhookByReceiverId(payload.receiverId);

      if (!webhook?.active || webhook.type !== `workgraph` || webhook.loop !== payload.loopId || webhook.workgraph !== payload.workgraphId) {
        await queryLoopWorkgraphMarkSyncFailed(payload.loopId, payload.workgraphId, `Webhook configuration changed before synchronization started.`);
        return { syncedCount: 0, createdTaskCount: 0, skipped: true };
      }
    }

    await queryLoopWorkgraphMarkSynchronizing(payload.loopId, payload.workgraphId);

    try {
      const result = await synchronizeLoopWorkgraphAndPromoteTasks(payload.loopId, payload.workgraphId);
      return { ...result, skipped: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await queryLoopWorkgraphMarkSyncFailed(payload.loopId, payload.workgraphId, message);
      throw error;
    }
  },
};

export const enqueueWorkgraphSync = async (payload: WorkgraphSyncPayload, requireIdle: boolean): Promise<BackgroundJobEnqueueResult> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const started = await queryLoopWorkgraphMarkSynchronizing(payload.loopId, payload.workgraphId, client);

    if (requireIdle && !started) {
      await client.query(`COMMIT`);
      return { accepted: false, jobId: null };
    }

    const result = await backgroundJobEnqueue(workgraphSyncJobDefinition, payload, { singletonKey: `${payload.loopId}:${payload.workgraphId}` }, client);
    await client.query(`COMMIT`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

backgroundJobRegister(workgraphSyncJobDefinition);
