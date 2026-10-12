import type { JobWithMetadata, QueueOptions, QueuePolicy, SendOptions, WorkOptions } from "pg-boss";
import { z } from "zod";

export const backgroundJobPayloadEnvelopeSchema = z.object({
  version: z.int().positive(),
  payload: z.record(z.string(), z.unknown()),
});

export type BackgroundJobPayloadEnvelope = z.infer<typeof backgroundJobPayloadEnvelopeSchema>;

export type BackgroundJobHandlerContext<TPayload extends Record<string, unknown>> = {
  job: JobWithMetadata<BackgroundJobPayloadEnvelope>;
  payload: TPayload;
};

export type BackgroundJobDefinition<TPayload extends Record<string, unknown> = Record<string, unknown>, TResult extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  version: number;
  payloadSchema: z.ZodType<TPayload>;
  queue?: QueueOptions & { policy?: QueuePolicy };
  worker?: WorkOptions;
  handler(context: BackgroundJobHandlerContext<TPayload>): Promise<TResult>;
};

export type BackgroundJobEnqueueOptions = Pick<SendOptions, "singletonKey" | "startAfter">;

export type BackgroundJobEnqueueResult = { accepted: true; jobId: string } | { accepted: false; jobId: null };
