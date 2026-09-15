import { BackgroundJobConfigurationError } from "./background-job.errors.js";
import type { BackgroundJobDefinition } from "./background-job.schema.js";

const definitions = new Map<string, BackgroundJobDefinition>();
let sealed = false;

export const backgroundJobRegister = (definition: BackgroundJobDefinition): void => {
  if (sealed) {
    throw new BackgroundJobConfigurationError(`Background jobs cannot be registered after the registry is sealed.`);
  }

  if (definitions.has(definition.name)) {
    throw new BackgroundJobConfigurationError(`Background job name \`${definition.name}\` is registered more than once.`);
  }

  definitions.set(definition.name, definition);
};

export const backgroundJobDefinitions = (): readonly BackgroundJobDefinition[] => [...definitions.values()];

export const backgroundJobSealRegistry = (): readonly BackgroundJobDefinition[] => {
  sealed = true;
  return backgroundJobDefinitions();
};
