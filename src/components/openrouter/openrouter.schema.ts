import type { AppLogger } from "@components/logging/logging.schema.js";
import { z } from "zod";

export const openRouterConnectionSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
});

export const openRouterMessageSchema = z.object({
  role: z.enum([`system`, `user`, `assistant`]),
  content: z.string(),
});

export const openRouterChatCompletionPayloadSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.unknown().optional(),
            reasoning: z.string().nullable().optional(),
            reasoning_details: z
              .array(
                z.object({
                  type: z.string().optional(),
                  text: z.string().optional(),
                }),
              )
              .nullable()
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

export const openRouterChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(openRouterMessageSchema),
  temperature: z.number().optional(),
  // When 'text', response_format is omitted (plain conversational reply)
  responseFormat: z.enum([`json_object`, `text`]).optional(),
  idempotencyKey: z.string().optional(),
  sessionId: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  operation: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  logger: z.custom<AppLogger>().optional(),
});

export type OpenRouterConnection = z.infer<typeof openRouterConnectionSchema>;
export type OpenRouterMessage = z.infer<typeof openRouterMessageSchema>;
export type OpenRouterChatCompletionPayload = z.infer<typeof openRouterChatCompletionPayloadSchema>;
export type OpenRouterChatCompletionRequest = z.infer<typeof openRouterChatCompletionRequestSchema>;
