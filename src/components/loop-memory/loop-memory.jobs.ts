import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import type { LoopMemoryBackfillPayload, LoopMemoryIngestPayload } from "./loop-memory.schema.js";
import { loopMemoryBackfillPayloadSchema, loopMemoryIngestPayloadSchema } from "./loop-memory.schema.js";
import { indexLoopMemoryBackfill, indexLoopMemoryItem } from "./loop-memory.service.js";

export const loopMemoryBackfillJob: BackgroundJobDefinition<LoopMemoryBackfillPayload> = {
  name: `loop-memory.backfill`,
  version: 1,
  payloadSchema: loopMemoryBackfillPayloadSchema,
  handler: async ({ payload }) => indexLoopMemoryBackfill(payload.loop, payload.generation),
};

export const loopMemoryIngestJob: BackgroundJobDefinition<LoopMemoryIngestPayload> = {
  name: `loop-memory.ingest`,
  version: 1,
  payloadSchema: loopMemoryIngestPayloadSchema,
  handler: async ({ payload }) => indexLoopMemoryItem(payload.loop, payload.task, payload.queueItem),
};
