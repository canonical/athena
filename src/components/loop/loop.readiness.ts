import type { LoopReadiness, LoopReadinessBlocker } from "./loop.schema.js";

export type LoopReadinessCounts = {
  activeRoutingPersonaCount: number;
  activeExecutionPersonaCount: number;
  activeChatProviderCount: number;
  activeRunnerCount: number;
  activeWorkgraphCount: number;
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

  if (counts.activeChatProviderCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_CHAT_PROVIDER`,
      message: `No active chat-capable provider assignment is available for this loop.`,
    });
  }

  if (counts.activeRunnerCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_RUNNER`,
      message: `No active runner assignment is available for this loop.`,
    });
  }

  if (counts.activeWorkgraphCount === 0) {
    blockers.push({
      code: `NO_ACTIVE_WORKGRAPH`,
      message: `No active workgraph assignment is available for this loop.`,
    });
  }

  return {
    loop: loopId,
    blocked: blockers.length > 0,
    blockers,
  };
};
