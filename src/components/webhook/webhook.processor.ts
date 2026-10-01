import { log } from "@components/logging/logging.service.js";
import {
  queryLoopWorkgraphMarkSyncFailed,
  queryLoopWorkgraphMarkSynchronizing,
  queryWebhookByReceiverId,
  queryWebhookItemClaimNext,
  queryWebhookItemMarkDone,
  queryWebhookItemPing,
  queryWebhookItemRequeue,
} from "@components/workgraph/workgraph.pg.service.js";
import { synchronizeLoopWorkgraphAndPromoteTasks } from "@components/workgraph/workgraph.sync.service.js";

const webhookItemHeartbeatIntervalMs = 30_000;

let isProcessing = false;
let isStopping = false;
let currentRun: Promise<void> | null = null;

const processWebhookItem = async (item: { id: string; payload: Record<string, unknown>; reclaimed: boolean }): Promise<void> => {
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

  if (item.reclaimed) {
    await queryLoopWorkgraphMarkSyncFailed(webhook.loop, webhook.workgraph, `Previous webhook synchronization attempt did not complete.`);
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

const pingWebhookItem = async (id: string): Promise<void> => {
  try {
    await queryWebhookItemPing(id);
  } catch (error) {
    log.error(`Webhook item heartbeat failed`, {
      itemId: id,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  }
};

const processQueue = async (): Promise<void> => {
  while (!isStopping) {
    const item = await queryWebhookItemClaimNext();

    if (!item) {
      return;
    }

    const heartbeatInterval = setInterval(() => {
      void pingWebhookItem(item.id);
    }, webhookItemHeartbeatIntervalMs);

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
    } finally {
      clearInterval(heartbeatInterval);
    }
  }
};

export const triggerWebhookItemProcessor = (): void => {
  if (isStopping || isProcessing) {
    return;
  }

  isProcessing = true;

  currentRun = (async () => {
    try {
      await processQueue();
    } catch (error) {
      log.error(`Webhook item processor failed`, {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });
    } finally {
      isProcessing = false;
      currentRun = null;
    }
  })();
};

export const startWebhookItemProcessor = (): void => {
  triggerWebhookItemProcessor();
};

// Stops accepting triggers and waits for the in-flight item to finish.
export const stopWebhookItemProcessor = async (): Promise<void> => {
  isStopping = true;
  await currentRun;
};
