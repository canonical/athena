import { delay } from "@components/utilities/timers.js";

export const retry = async <T>(operation: () => Promise<T>, retries: number, intervalMs: number): Promise<T> => {
  for (let retryIndex = 0; ; retryIndex += 1) {
    try {
      return await operation();
    } catch (error) {
      if (retryIndex >= retries) {
        throw error;
      }

      await delay(intervalMs);
    }
  }
};
