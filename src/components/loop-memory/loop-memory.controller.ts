import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { LoopForbiddenError, LoopNotFoundError, LoopValidationError } from "@components/loop/loop.errors.js";
import { queryLoopAdminMembership, queryLoopForUser } from "@components/loop/loop.service.js";
import { withTransaction } from "@components/postgres/postgres.js";
import { loopMemoryBackfillJob } from "./loop-memory.jobs.js";
import type { LoopMemoryConfig, LoopMemoryConfigUpdate } from "./loop-memory.schema.js";
import { queryLoopMemoryConfig, queryLoopMemoryDisable, queryLoopMemoryEnable } from "./loop-memory.service.js";

export const loopMemoryGet = async (loopId: string, userId: string): Promise<LoopMemoryConfig> => {
  const config = await queryLoopMemoryConfig(loopId, userId);
  if (!config) throw new LoopNotFoundError(`Loop not found.`);
  return config;
};

export const loopMemoryUpdate = async (loopId: string, userId: string, input: LoopMemoryConfigUpdate): Promise<LoopMemoryConfig> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) throw new LoopNotFoundError(`Loop not found.`);
    throw new LoopForbiddenError(`Only loop admins may configure loop history memory.`);
  }

  await withTransaction(async (transaction) => {
    if (!input.hasHistoryRag) {
      await queryLoopMemoryDisable(transaction, loopId, userId);
    } else {
      const provider = input.provider;
      if (!provider) throw new LoopValidationError(`An embedding provider is required when loop history memory is enabled.`);

      const result = await queryLoopMemoryEnable(transaction, loopId, provider, userId);
      if (result.outcome === `invalid`) {
        throw new LoopValidationError(`Select an active embedding provider that you own.`);
      }
      if (result.outcome === `rebuild`) await backgroundJobEnqueue(transaction, loopMemoryBackfillJob, { loop: loopId, generation: result.generation }, { singletonKey: loopId });
    }
  });

  return loopMemoryGet(loopId, userId);
};
