import type { ProviderToolExecutionContext } from "@components/tool/tool.schema.js";
import { lookupLoopMemory } from "./loop-memory.service.js";

export const executeOwnMemoryLookup = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined) => {
  const query = typeof input?.query === `string` ? input.query.trim() : ``;
  const limit = typeof input?.limit === `number` ? Math.min(20, Math.max(1, Math.trunc(input.limit))) : 5;
  if (!query) throw new Error(`Memory lookup query is required.`);
  return lookupLoopMemory(context.loopId, query, limit);
};
