import type { AppLogger } from "@components/logging/logging.schema.js";
import { z } from "zod";

export const openRouterConnectionSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
});

export const openRouterMessageSchema = z.object({
  role: z.enum([`system`, `user`, `assistant`, `tool`]),
  content: z.union([z.string(), z.null()]),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal(`function`),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
});

export const openRouterToolSchema = z.object({
  type: z.literal(`function`),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()),
  }),
});

export const openRouterChatCompletionPayloadSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z
          .object({
            content: z.unknown().optional(),
            tool_calls: z
              .array(
                z.object({
                  id: z.string(),
                  type: z.literal(`function`),
                  function: z.object({
                    name: z.string(),
                    arguments: z.string(),
                  }),
                }),
              )
              .optional(),
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
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      cost: z.union([z.number(), z.string()]).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const openRouterChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(openRouterMessageSchema),
  tools: z.array(openRouterToolSchema).optional(),
  toolChoice: z.literal(`auto`).optional(),
  parallelToolCalls: z.boolean().optional(),
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
export type OpenRouterTool = z.infer<typeof openRouterToolSchema>;
export type OpenRouterChatCompletionPayload = z.infer<typeof openRouterChatCompletionPayloadSchema>;
export type OpenRouterChatCompletionRequest = z.infer<typeof openRouterChatCompletionRequestSchema>;
