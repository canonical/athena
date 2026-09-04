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

export type BackgroundJobEnqueueOptions = Pick<SendOptions, "group" | "singletonKey" | "startAfter">;

export const backgroundJobEnqueueResultSchema = z.discriminatedUnion(`accepted`, [z.object({ accepted: z.literal(true), jobId: z.string().min(1) }), z.object({ accepted: z.literal(false), jobId: z.null() })]);

export type BackgroundJobEnqueueResult = z.infer<typeof backgroundJobEnqueueResultSchema>;
