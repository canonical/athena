import { z } from "zod";
import { uuid } from "@components/utilities/zod.utilities.js";

export const providerToolRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
});
export type ProviderToolRequest = z.infer<typeof providerToolRequestSchema>;

export const providerToolExecutionContextSchema = z.object({
  taskId: uuid(),
  loopId: uuid(),
  claimToken: uuid().nullable(),
});
export type ProviderToolExecutionContext = z.infer<typeof providerToolExecutionContextSchema>;

export const providerToolResultSchema = z.object({
  tool: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type ProviderToolResult = z.infer<typeof providerToolResultSchema>;

export const providerToolBatchResultSchema = z.object({
  results: z.array(providerToolResultSchema),
  hadError: z.boolean(),
});
export type ProviderToolBatchResult = z.infer<typeof providerToolBatchResultSchema>;
