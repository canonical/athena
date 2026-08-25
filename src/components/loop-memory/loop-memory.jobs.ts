import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import type { LoopMemoryBackfillPayload, LoopMemoryIngestPayload } from "./loop-memory.schema.js";
import { loopMemoryBackfillPayloadSchema, loopMemoryIngestPayloadSchema } from "./loop-memory.schema.js";
import { indexLoopMemoryBackfill, indexLoopMemoryItem } from "./loop-memory.service.js";

export const loopMemoryBackfillJob: BackgroundJobDefinition<LoopMemoryBackfillPayload> = {
  name: `loop-memory.backfill`,
  version: 1,
  payloadSchema: loopMemoryBackfillPayloadSchema,
  queue: { policy: `singleton`, expireInSeconds: 21_600, heartbeatSeconds: 60 },
  handler: async ({ job, payload }) => indexLoopMemoryBackfill(payload.loop, payload.generation, job.signal),
};

export const loopMemoryIngestJob: BackgroundJobDefinition<LoopMemoryIngestPayload> = {
  name: `loop-memory.ingest`,
  version: 1,
  payloadSchema: loopMemoryIngestPayloadSchema,
  queue: { policy: `singleton` },
  handler: async ({ job, payload }) => indexLoopMemoryItem(payload.loop, payload.task, payload.queueItem, job.signal),
};
