import { isoDateTime, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const loopMemoryStatuses = [`missing`, `indexing`, `ready`, `failed`] as const;

export const loopMemoryConfigSchema = z.object({
  loop: uuid(),
  hasHistoryRag: z.boolean(),
  provider: uuid().nullable(),
  providerDisplayName: z.string().nullable(),
  embeddingModel: z.string().nullable(),
  status: z.enum(loopMemoryStatuses).nullable(),
  failureMessage: z.string().nullable(),
  embeddingDimensions: z.int().positive().nullable(),
  updatedAt: isoDateTime.nullable(),
});

export const loopMemoryConfigUpdateSchema = z
  .object({
    hasHistoryRag: z.boolean(),
    provider: uuid().nullable(),
  })
  .refine((value) => !value.hasHistoryRag || value.provider !== null, { message: `An embedding provider is required when loop history memory is enabled.`, path: [`provider`] });

export const loopMemoryBackfillPayloadSchema = z.object({ loop: uuid(), generation: uuid() });
export const loopMemoryIngestPayloadSchema = z.object({ loop: uuid(), task: uuid(), queueItem: uuid().optional() });

export type LoopMemoryConfig = z.infer<typeof loopMemoryConfigSchema>;
export type LoopMemoryConfigUpdate = z.infer<typeof loopMemoryConfigUpdateSchema>;
export type LoopMemoryBackfillPayload = z.infer<typeof loopMemoryBackfillPayloadSchema>;
export type LoopMemoryIngestPayload = z.infer<typeof loopMemoryIngestPayloadSchema>;
