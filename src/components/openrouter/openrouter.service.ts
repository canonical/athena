import type { AppLogger } from "@components/logging/logging.schema.js";
import { log } from "@components/logging/logging.service.js";
import type { ProviderModel } from "@components/provider/provider.schema.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";
import type { OpenRouterChatCompletionPayload, OpenRouterChatCompletionRequest, OpenRouterConnection } from "./openrouter.schema.js";

const normalizeBaseUrl = (value: string): string => value.replace(/\/$/, ``);

const readReasoningDetailsText = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return ``;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== `object`) {
        return ``;
      }

      const reasoningPart = entry as { type?: unknown; text?: unknown };
      return reasoningPart.type === `reasoning.text` && typeof reasoningPart.text === `string` ? reasoningPart.text : ``;
    })
    .filter((part) => part.length > 0)
    .join(`\n`);
};

export const readOpenRouterContentText = (content: unknown): string => {
  if (typeof content === `string`) {
    return content;
  }

  if (!Array.isArray(content)) {
    return ``;
  }

  return content
    .map((part) => {
      if (!part || typeof part !== `object`) {
        return ``;
      }

      const textPart = part as { type?: unknown; text?: unknown };
      return textPart.type === `text` && typeof textPart.text === `string` ? textPart.text : ``;
    })
    .filter((part) => part.length > 0)
    .join(`\n`);
};

export const readOpenRouterAssistantText = (message: { content?: unknown; reasoning?: unknown; reasoning_details?: unknown } | undefined): string => {
  const contentText = readOpenRouterContentText(message?.content).trim();

  if (contentText.length > 0) {
    return contentText;
  }

  const reasoningText = typeof message?.reasoning === `string` ? message.reasoning.trim() : ``;

  if (reasoningText.length > 0) {
    return reasoningText;
  }

  return readReasoningDetailsText(message?.reasoning_details).trim();
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

export const readOpenRouterUsageCostUsd = (payload: { usage?: { cost?: unknown } | null } | null | undefined): number | null => {
  const rawCost = payload?.usage?.cost;

  if (typeof rawCost === `number`) {
    return Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : null;
  }

  if (typeof rawCost === `string`) {
    const parsed = Number(rawCost);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
};

export const parseOpenRouterFirstChoiceJsonObject = (payload: { choices?: Array<{ message?: { content?: unknown } }> }, errorMessagePrefix = `OpenRouter response`): Record<string, unknown> => {
  const content = readOpenRouterAssistantText(payload.choices?.[0]?.message).trim();

  if (!content.startsWith(`{`) || !content.endsWith(`}`)) {
    throw new Error(`${errorMessagePrefix} returned non-JSON output.`);
  }

  const parsed = JSON.parse(content) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`${errorMessagePrefix} returned invalid JSON object.`);
  }

  return parsed;
};

const readErrorMessage = (payload: unknown, status: number, fallback: string): string => {
  if (payload && typeof payload === `object` && `error` in payload && typeof (payload as { error?: { message?: unknown } }).error?.message === `string`) {
    return (payload as { error: { message: string } }).error.message;
  }

  return `${fallback} (status ${status}).`;
};

type OpenRouterModelRecord = ProviderModel & {};

const readString = (value: unknown): string | undefined => (typeof value === `string` && value.trim().length > 0 ? value.trim() : undefined);

const readPositiveInteger = (value: unknown): number | undefined => (typeof value === `number` && Number.isInteger(value) && value > 0 ? value : undefined);

const readStringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry));

  return items.length > 0 ? items : undefined;
};

const readModelList = (payload: unknown): OpenRouterModelRecord[] => {
  if (!payload || typeof payload !== `object`) {
    return [];
  }

  const data = (payload as { data?: unknown }).data;

  if (!Array.isArray(data)) {
    return [];
  }

  const models: OpenRouterModelRecord[] = [];

  for (const entry of data) {
    if (!entry || typeof entry !== `object`) {
      continue;
    }

    const id = (entry as { id?: unknown }).id;
    const name = (entry as { name?: unknown }).name;
    const description = readString((entry as { description?: unknown }).description);
    const knowledgeCutoff = readString((entry as { knowledge_cutoff?: unknown }).knowledge_cutoff) ?? null;
    const contextLength = readPositiveInteger((entry as { context_length?: unknown }).context_length);
    const architecture = (entry as { architecture?: unknown }).architecture;
    const topProvider = (entry as { top_provider?: unknown }).top_provider;
    const pricing = (entry as { pricing?: unknown }).pricing;
    const supportedParameters = readStringList((entry as { supported_parameters?: unknown }).supported_parameters);
    const reasoning = (entry as { reasoning?: unknown }).reasoning;

    if (typeof id !== `string` || id.trim().length === 0) {
      continue;
    }

    models.push({
      id: id.trim(),
      displayName: typeof name === `string` && name.trim().length > 0 ? name.trim() : undefined,
      description,
      contextLength,
      maxCompletionTokens: readPositiveInteger((topProvider as { max_completion_tokens?: unknown } | undefined)?.max_completion_tokens),
      modality: readString((architecture as { modality?: unknown } | undefined)?.modality),
      inputModalities: readStringList((architecture as { input_modalities?: unknown } | undefined)?.input_modalities),
      outputModalities: readStringList((architecture as { output_modalities?: unknown } | undefined)?.output_modalities),
      promptPrice: readString((pricing as { prompt?: unknown } | undefined)?.prompt),
      completionPrice: readString((pricing as { completion?: unknown } | undefined)?.completion),
      requestPrice: readString((pricing as { request?: unknown } | undefined)?.request),
      imagePrice: readString((pricing as { image?: unknown } | undefined)?.image),
      supportedParameters,
      knowledgeCutoff,
      reasoningSupported: Array.isArray((reasoning as { supported_efforts?: unknown } | undefined)?.supported_efforts),
      reasoningEfforts: readStringList((reasoning as { supported_efforts?: unknown } | undefined)?.supported_efforts),
    });
  }

  return models;
};

const toProviderModelList = (models: OpenRouterModelRecord[]): ProviderModel[] =>
  models.map((model) => ({
    id: model.id,
    displayName: model.displayName,
    description: model.description,
    contextLength: model.contextLength,
    maxCompletionTokens: model.maxCompletionTokens,
    modality: model.modality,
    inputModalities: model.inputModalities,
    outputModalities: model.outputModalities,
    promptPrice: model.promptPrice,
    completionPrice: model.completionPrice,
    requestPrice: model.requestPrice,
    imagePrice: model.imagePrice,
    supportedParameters: model.supportedParameters,
    knowledgeCutoff: model.knowledgeCutoff,
    reasoningSupported: model.reasoningSupported,
    reasoningEfforts: model.reasoningEfforts,
  }));

export class OpenRouterRequestError extends Error {
  status: number;

  payload: OpenRouterChatCompletionPayload;

  constructor(message: string, status: number, payload: OpenRouterChatCompletionPayload) {
    super(message);
    this.name = `OpenRouterRequestError`;
    this.status = status;
    this.payload = payload;
  }
}

export type OpenRouterModelValidationResult = {
  available: boolean;
  status: number | null;
  reason: string | null;
  usageCostUsd: number;
  payload: OpenRouterChatCompletionPayload | null;
  error: OpenRouterRequestError | null;
};

export const validateOpenRouterModel = async (
  connection: OpenRouterConnection,
  request: {
    model: string;
    operation: string;
    timeoutMs?: number;
    sessionId?: string;
    logger?: AppLogger;
    context?: Record<string, unknown>;
  },
): Promise<OpenRouterModelValidationResult> => {
  try {
    const payload = await fetchOpenRouterChatCompletion(connection, {
      model: request.model,
      operation: request.operation,
      responseFormat: `text`,
      temperature: 0,
      timeoutMs: request.timeoutMs ?? 20_000,
      sessionId: request.sessionId,
      logger: request.logger,
      context: request.context,
      messages: [{ role: `user`, content: `.` }],
    });

    return {
      available: true,
      status: 200,
      reason: null,
      usageCostUsd: readOpenRouterUsageCostUsd(payload) ?? 0,
      payload,
      error: null,
    };
  } catch (error) {
    if (error instanceof OpenRouterRequestError) {
      return {
        available: false,
        status: error.status,
        reason: error.payload.error?.message ?? error.message,
        usageCostUsd: 0,
        payload: error.payload,
        error,
      };
    }

    throw error;
  }
};

export const fetchOpenRouterModels = async (connection: OpenRouterConnection, logger: AppLogger = log): Promise<ProviderModel[]> => {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const modelsEndpoint = `${baseUrl}/models`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 30_000);

  logger.info(`OpenRouter model list request started`, {
    endpoint: modelsEndpoint,
    timeoutMs: 30_000,
  });

  try {
    const modelsResponse = await fetchWithRetry(
      modelsEndpoint,
      {
        method: `GET`,
        headers: {
          Authorization: `Bearer ${connection.apiKey}`,
          "Content-Type": `application/json`,
        },
        signal: controller.signal,
      },
      {
        maxAttempts: 4,
        baseDelayMs: 400,
        maxDelayMs: 6_000,
      },
    );

    const modelsPayload = (await modelsResponse.json().catch(() => ({}))) as unknown;

    if (!modelsResponse.ok) {
      logger.warn(`OpenRouter model list request failed`, {
        endpoint: modelsEndpoint,
        status: modelsResponse.status,
        durationMs: Date.now() - startedAt,
      });
      throw new Error(readErrorMessage(modelsPayload, modelsResponse.status, `Provider model list request failed`));
    }

    const models = readModelList(modelsPayload);
    logger.info(`OpenRouter model list request completed`, {
      endpoint: modelsEndpoint,
      status: modelsResponse.status,
      modelCount: models.length,
      durationMs: Date.now() - startedAt,
    });
    return toProviderModelList(models);
  } catch (error) {
    logger.error(`OpenRouter model list request errored`, {
      endpoint: modelsEndpoint,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchOpenRouterChatCompletion = async (connection: OpenRouterConnection, request: OpenRouterChatCompletionRequest): Promise<OpenRouterChatCompletionPayload> => {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const endpoint = baseUrl.endsWith(`/chat/completions`) ? baseUrl : `${baseUrl}/chat/completions`;
  const timeoutMs = request.timeoutMs ?? 300_000;
  const startedAt = Date.now();
  const logger = request.logger ?? log;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  logger.info(`OpenRouter chat completion request started`, {
    endpoint,
    model: request.model,
    timeoutMs,
    operation: request.operation,
    ...request.context,
  });

  try {
    const response = await fetchWithRetry(
      endpoint,
      {
        method: `POST`,
        headers: {
          Authorization: `Bearer ${connection.apiKey}`,
          "Content-Type": `application/json`,
          ...(request.idempotencyKey ? { "Idempotency-Key": request.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          temperature: request.temperature ?? 0,
          ...(request.responseFormat !== `text` ? { response_format: { type: `json_object` } } : {}),
          ...(request.sessionId ? { session_id: request.sessionId } : {}),
          ...(request.tools ? { tools: request.tools } : {}),
          ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
          ...(request.parallelToolCalls !== undefined ? { parallel_tool_calls: request.parallelToolCalls } : {}),
          messages: request.messages,
        }),
        signal: controller.signal,
      },
      {
        maxAttempts: 4,
        baseDelayMs: 600,
        maxDelayMs: 8_000,
        allowRetryOnNonIdempotentMethods: true,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as OpenRouterChatCompletionPayload;

    if (!response.ok) {
      logger.warn(`OpenRouter chat completion request failed`, {
        endpoint,
        model: request.model,
        status: response.status,
        durationMs: Date.now() - startedAt,
        operation: request.operation,
        ...request.context,
      });

      throw new OpenRouterRequestError(readErrorMessage(payload, response.status, `OpenRouter chat completion request failed`), response.status, payload);
    }

    logger.info(`OpenRouter chat completion request completed`, {
      endpoint,
      model: request.model,
      status: response.status,
      durationMs: Date.now() - startedAt,
      operation: request.operation,
      ...request.context,
    });

    return payload;
  } catch (error) {
    logger.error(`OpenRouter chat completion request errored`, {
      endpoint,
      model: request.model,
      durationMs: Date.now() - startedAt,
      operation: request.operation,
      ...request.context,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
