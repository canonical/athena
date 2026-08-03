import type { LoopReadiness, LoopReadinessBlocker } from "./loop.schema.js";

export type LoopReadinessCounts = {
  activeRoutingPersonaCount: number;
  activeExecutionPersonaCount: number;
  activeProviderCount: number;
  activeProviderWithModelConfigCount: number;
  activeProviderMissingModelConfigCount: number;
  activeRunnerCount: number;
};

export const evaluateLoopReadiness = (loopId: string, counts: LoopReadinessCounts): LoopReadiness => {
  const blockers: LoopReadinessBlocker[] = [];

  if (counts.activeRoutingPersonaCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_ROUTING_PERSONA`,
      message: `No active routing persona is assigned to this loop.`,
    });
  }

  if (counts.activeRoutingPersonaCount > 1) {
    blockers.push({
      code: `MULTIPLE_ACTIVE_ROUTING_PERSONAS`,
      message: `Multiple active routing personas are assigned to this loop. Exactly one is required.`,
    });
  }

  if (counts.activeExecutionPersonaCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_EXECUTION_PERSONA`,
      message: `No active non-routing persona is assigned to this loop.`,
    });
  }

  if (counts.activeProviderCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_PROVIDER`,
      message: `No active provider assignment is available for this loop.`,
    });
  } else {
    if (counts.activeProviderWithModelConfigCount === 0) {
      blockers.push({
        code: `NO_PROVIDER_MODEL_CONFIGURATION`,
        message: `No active provider assignment has a default model and enabled models configured.`,
      });
    }

    if (counts.activeProviderMissingModelConfigCount > 0) {
      blockers.push({
        code: `PROVIDER_MODEL_CONFIGURATION_INCOMPLETE`,
        message: `One or more active provider assignments are missing default model or enabled models configuration.`,
      });
    }
  }

  if (counts.activeRunnerCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_RUNNER`,
      message: `No active runner assignment is available for this loop.`,
    });
  }

  return {
    loop: loopId,
    blocked: blockers.length > 0,
    blockers,
  };
};
