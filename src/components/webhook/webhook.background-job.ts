import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import { queryLoopWorkgraphMarkSyncFailed, queryLoopWorkgraphMarkSynchronizing, queryWebhookByReceiverId } from "@components/workgraph/workgraph.pg.service.js";
import { synchronizeLoopWorkgraphAndPromoteTasks } from "@components/workgraph/workgraph.sync.service.js";
import { type WebhookBackgroundJobPayload, webhookBackgroundJobPayloadSchema } from "./webhook.schema.js";

export const webhookBackgroundJobDefinition: BackgroundJobDefinition<WebhookBackgroundJobPayload> = {
  name: `webhook-workgraph-sync`,
  version: 1,
  payloadSchema: webhookBackgroundJobPayloadSchema,
  queue: {
    retryLimit: 2,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 3_600,
    heartbeatSeconds: 30,
    deleteAfterSeconds: 604_800,
  },
  worker: {
    groupConcurrency: 1,
  },
  async handler({ job, payload }) {
    const webhook = await queryWebhookByReceiverId(payload.receiverId);

    if (!webhook?.active || webhook.type !== `workgraph`) {
      return { skipped: true };
    }

    if (job.retryCount > 0) {
      await queryLoopWorkgraphMarkSyncFailed(webhook.loop, webhook.workgraph, `Previous webhook synchronization attempt did not complete.`);
    }

    const started = await queryLoopWorkgraphMarkSynchronizing(webhook.loop, webhook.workgraph);

    if (!started) {
      return { skipped: true };
    }

    try {
      return await synchronizeLoopWorkgraphAndPromoteTasks(webhook.loop, webhook.workgraph);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await queryLoopWorkgraphMarkSyncFailed(webhook.loop, webhook.workgraph, message);
      throw error;
    }
  },
};
