import { log } from "@components/logging/logging.service.js";
import { queryLoopWorkgraphMarkSyncFailed, queryLoopWorkgraphMarkSynchronizing, queryWebhookByReceiverId, queryWebhookItemClaimNext, queryWebhookItemMarkDone, queryWebhookItemRequeue } from "@components/workgraph/workgraph.pg.service.js";
import { synchronizeLoopWorkgraphAndPromoteTasks } from "@components/workgraph/workgraph.sync.service.js";

let isProcessing = false;

const processWebhookItem = async (item: { id: string; payload: Record<string, unknown> }): Promise<void> => {
  const receiverId = typeof item.payload.receiverId === `string` ? item.payload.receiverId : ``;

  if (!receiverId) {
    return;
  }

  const webhook = await queryWebhookByReceiverId(receiverId);

  if (!webhook?.active) {
    return;
  }

  if (webhook.type !== `workgraph`) {
    return;
  }

  const started = await queryLoopWorkgraphMarkSynchronizing(webhook.loop, webhook.workgraph);

  if (!started) {
    // Another sync is already active for this loop/workgraph.
    return;
  }

  try {
    await synchronizeLoopWorkgraphAndPromoteTasks(webhook.loop, webhook.workgraph);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await queryLoopWorkgraphMarkSyncFailed(webhook.loop, webhook.workgraph, message);
    throw error;
  }
};

const processQueue = async (): Promise<void> => {
  while (true) {
    const item = await queryWebhookItemClaimNext();

    if (!item) {
      return;
    }

    try {
      await processWebhookItem(item);
      await queryWebhookItemMarkDone(item.id);
    } catch (error) {
      log.error(`Webhook item processing failed`, {
        itemId: item.id,
        retryCount: item.retryCount,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });

      if (item.retryCount >= 3) {
        await queryWebhookItemMarkDone(item.id);
        continue;
      }

      await queryWebhookItemRequeue(item.id);
    }
  }
};

export const triggerWebhookItemProcessor = (): void => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  void (async () => {
    try {
      await processQueue();
    } catch (error) {
      log.error(`Webhook item processor failed`, {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });
    } finally {
      isProcessing = false;
    }
  })();
};

export const startWebhookItemProcessor = (): void => {
  triggerWebhookItemProcessor();
};
