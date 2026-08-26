import type { Job, QueueOptions, QueuePolicy, WorkOptions } from "pg-boss";
import { z } from "zod";

export const backgroundJobPayloadEnvelopeSchema = z.object({
  version: z.int().positive(),
  payload: z.record(z.string(), z.unknown()),
});

export type BackgroundJobPayloadEnvelope = z.infer<typeof backgroundJobPayloadEnvelopeSchema>;

export type BackgroundJobHandlerContext<TPayload extends Record<string, unknown>> = {
  job: Job<BackgroundJobPayloadEnvelope>;
  payload: TPayload;
};

export type BackgroundJobDefinition<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  version: number;
  payloadSchema: z.ZodType<TPayload>;
  queue?: QueueOptions & { policy?: QueuePolicy };
  worker?: WorkOptions;
  handler(context: BackgroundJobHandlerContext<TPayload>): Promise<void>;
};

export type BackgroundJobEnqueueOptions = {
  singletonKey?: string;
};
