import type { AppLogger } from "@components/logging/logging.schema.js";
import type { OpenRouterChatCompletionPayload, OpenRouterChatCompletionRequest } from "@components/openrouter/openrouter.schema.js";
import { fetchOpenRouterChatCompletion, fetchOpenRouterModels, type OpenRouterModelValidationResult, validateOpenRouterModel } from "@components/openrouter/openrouter.service.js";
import type { ProviderModel } from "./provider.schema.js";
import type { ProviderApiConnection } from "./provider.service.js";

const isEmbeddingOnlyModel = (model: ProviderModel): boolean => {
  if (model.outputModalities?.includes(`embedding`)) return true;
  return model.modality?.toLowerCase().includes(`embedding`) ?? false;
};

export class ProviderChat {
  readonly connection: ProviderApiConnection;

  constructor(connection: ProviderApiConnection) {
    this.connection = connection;
  }

  async listModels(logger?: AppLogger): Promise<ProviderModel[]> {
    return (await fetchOpenRouterModels(this.connection, logger)).filter((model) => !isEmbeddingOnlyModel(model));
  }

  validateModel(model: string, options: Omit<Parameters<typeof validateOpenRouterModel>[1], `model`>): Promise<OpenRouterModelValidationResult> {
    return validateOpenRouterModel(this.connection, { model, ...options });
  }

  complete(request: OpenRouterChatCompletionRequest): Promise<OpenRouterChatCompletionPayload> {
    return fetchOpenRouterChatCompletion(this.connection, request);
  }
}
