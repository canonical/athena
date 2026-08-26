import { loopMemoryBackfillJob, loopMemoryIngestJob } from "../loop-memory/loop-memory.jobs.js";
import { BackgroundJobConfigurationError } from "./background-job.errors.js";
import type { BackgroundJobDefinition } from "./background-job.schema.js";

const definitions: BackgroundJobDefinition[] = [loopMemoryBackfillJob, loopMemoryIngestJob];

export const backgroundJobDefinitions = (): readonly BackgroundJobDefinition[] => definitions;

export const backgroundJobValidateRegistry = (): void => {
  const names = new Set<string>();

  for (const definition of definitions) {
    if (names.has(definition.name)) {
      throw new BackgroundJobConfigurationError(`Background job name \`${definition.name}\` is registered more than once.`);
    }

    names.add(definition.name);
  }
};
