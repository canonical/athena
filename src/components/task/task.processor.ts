import { log } from "@components/logging/logging.service.js";
import { taskProcessQueue, taskPromotePoolReadyTasks } from "./task.controller.js";

type TaskProcessorOptions = {
  intervalMs?: number;
  poolReadinessIntervalMs?: number;
};

export const startTaskProcessor = ({ intervalMs = 1500, poolReadinessIntervalMs = 60_000 }: TaskProcessorOptions = {}): void => {
  let isQueueProcessing = false;
  let isPoolReadinessProcessing = false;

  const runQueueProcessor = () => {
    if (isQueueProcessing) {
      return;
    }

    isQueueProcessing = true;

    void (async () => {
      try {
        await taskProcessQueue();
      } catch (error) {
        log.error(`Task queue processor failed`, {
          error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
        });
      } finally {
        isQueueProcessing = false;
      }
    })();
  };

  const runPoolReadinessProcessor = () => {
    if (isPoolReadinessProcessing) {
      return;
    }

    isPoolReadinessProcessing = true;

    void (async () => {
      try {
        await taskPromotePoolReadyTasks();
      } catch (error) {
        log.error(`Task pool readiness processor failed`, {
          error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
        });
      } finally {
        isPoolReadinessProcessing = false;
      }
    })();
  };

  setInterval(runQueueProcessor, intervalMs);
  setInterval(runPoolReadinessProcessor, poolReadinessIntervalMs);
  runQueueProcessor();
  runPoolReadinessProcessor();
};
