import type { WorkshopEnvironmentSnapshot } from "@components/environment/environment.schemas.js";
import type { ModelUpsertRecord } from "@components/model/model.schemas.js";
import { loadOllamaCatalog, type OllamaLibraryFetchOptions } from "@components/ollama/ollama-catalog.client.js";
import type { GenerateRequest, ProgressResponse } from "ollama";
import ollama from "ollama";

const normalizeDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toISOString();
};

const formatProgressPercentage = (completed: number, total: number) => {
  if (total <= 0) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.floor((completed / total) * 100)));
};

const toProgressLogPercentage = (percentage: number) => {
  return Math.floor(percentage / 10) * 10;
};

const logPullProgress = (model: string, progress: ProgressResponse, lastLoggedPercentage: number | null) => {
  if (typeof progress.completed !== `number` || typeof progress.total !== `number`) {
    console.log(`[ollama pull] ${model}: ${progress.status}`);

    return lastLoggedPercentage;
  }

  const nextPercentage = formatProgressPercentage(progress.completed, progress.total);

  if (nextPercentage == null) {
    return lastLoggedPercentage;
  }

  const nextLoggedPercentage = toProgressLogPercentage(nextPercentage);

  if (nextLoggedPercentage === lastLoggedPercentage) {
    return lastLoggedPercentage;
  }

  console.log(`[ollama pull] ${model}: ${progress.status} (${nextLoggedPercentage}%)`);

  return nextLoggedPercentage;
};

/**
 * Athena wrapper over local Ollama runtime metadata and the remote Ollama library catalog.
 */
export const ollamaClient = {
  list: async (): Promise<WorkshopEnvironmentSnapshot[`ollama`][`models`]> => {
    const response = await ollama.list();

    return response.models.map((model) => ({
      name: model.name,
      id: model.digest ?? model.model ?? null,
      size: model.size != null ? `${model.size}` : null,
      modified: normalizeDate(model.modified_at),
    }));
  },

  pull: async (model: string): Promise<void> => {
    let lastLoggedPercentage: number | null = null;

    for await (const progress of await ollama.pull({ model, stream: true })) {
      lastLoggedPercentage = logPullProgress(model, progress, lastLoggedPercentage);
    }
  },

  generate: async (request: GenerateRequest): Promise<string> => {
    const response = await ollama.generate({ ...request, stream: false });

    return response.response;
  },

  catalog: async (options: OllamaLibraryFetchOptions = {}): Promise<ModelUpsertRecord[]> => {
    return loadOllamaCatalog(options);
  },
};
