import type { ModelUpsertRecord } from "@components/model/model.schemas.js";
import { listModelsBySource, upsertModel } from "@components/model/model.service.js";
import type { OllamaLibraryModel } from "@components/ollama/ollama.schemas.js";
import { OLLAMA_LIBRARY_URL, parseOllamaLibraryDetailPage, parseOllamaLibraryIndex } from "@components/ollama/ollama-library.parser.js";

const DEFAULT_LIBRARY_TIMEOUT_MS = 30_000;
const OLLAMA_MODEL_SOURCE = `ollama`;

export type OllamaLibraryFetchOptions = {
  timeoutMs?: number;
  refresh?: boolean;
};

const parseContextTokens = (contextSize: string | null): number | null => {
  if (!contextSize) {
    return null;
  }

  const normalizedValue = contextSize.trim().toUpperCase();
  const match = normalizedValue.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);

  if (!match) {
    const parsedValue = Number(normalizedValue);

    return Number.isFinite(parsedValue) ? Math.floor(parsedValue) : null;
  }

  const [, rawAmount, rawUnit] = match;
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const multiplierByUnit = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
  };

  if (!rawUnit) {
    return Math.floor(amount);
  }

  return Math.floor(amount * multiplierByUnit[rawUnit as keyof typeof multiplierByUnit]);
};

const parseInputTypes = (inputType: string | null): string[] => {
  if (!inputType) {
    return [];
  }

  return inputType
    .split(`,`)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const shouldPersistVariant = (tag: string): boolean => {
  return tag.trim().toLowerCase() !== `latest`;
};

const toModelRows = (source: string, models: OllamaLibraryModel[]): ModelUpsertRecord[] => {
  return models.flatMap((model) => {
    return model.variants
      .filter((variant) => shouldPersistVariant(variant.tag))
      .map((variant) => ({
        source,
        slug: variant.name,
        href: variant.href,
        summary: model.summary,
        capabilities: model.capabilities,
        size: variant.sizeOrUsage,
        contextTokens: parseContextTokens(variant.contextWindow),
        inputTypes: parseInputTypes(variant.inputType),
        readmeMarkdown: model.readmeMarkdown,
        license: model.license,
        fetchedAt: model.fetchedAt,
      }));
  });
};

const fetchHtml = async (url: string, timeoutMs: number) => {
  const response = await fetch(url, {
    headers: {
      accept: `text/html,application/xhtml+xml`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return response.text();
};

const buildFallbackCatalogModel = (entry: ReturnType<typeof parseOllamaLibraryIndex>[number], fetchedAt: string): OllamaLibraryModel => {
  return {
    slug: entry.slug,
    name: entry.name,
    href: entry.href,
    summary: entry.summary,
    capabilities: entry.capabilities,
    parameterSizes: entry.parameterSizes,
    downloads: entry.downloads,
    tagCount: entry.tagCount,
    updated: {
      relative: entry.updatedRelative,
      title: entry.updatedTitle,
    },
    applications: [],
    variants: [],
    readmeMarkdown: null,
    license: {
      label: null,
      href: null,
      text: null,
    },
    fetchedAt,
  };
};

const fetchCatalog = async (options: OllamaLibraryFetchOptions = {}): Promise<ModelUpsertRecord[]> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LIBRARY_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();
  const indexHtml = await fetchHtml(OLLAMA_LIBRARY_URL, timeoutMs);
  const indexEntries = parseOllamaLibraryIndex(indexHtml);
  const models: OllamaLibraryModel[] = [];

  console.log(`Fetching Ollama library details for ${indexEntries.length} entries with timeout ${timeoutMs}ms...`);

  for (const entry of indexEntries) {
    try {
      const detailHtml = await fetchHtml(entry.href, timeoutMs);

      models.push(parseOllamaLibraryDetailPage(detailHtml, entry));
      if (models.length % 10 === 0) {
        console.log(`Fetched details for ${models.length} models so far...`);
      }
    } catch {
      models.push(buildFallbackCatalogModel(entry, fetchedAt));
    }
  }

  const records = toModelRows(OLLAMA_MODEL_SOURCE, models);

  for (const record of records) {
    await upsertModel(record);
  }

  return records;
};

/**
 * Loads persisted model rows unless a refresh is explicitly requested.
 */
export const loadOllamaCatalog = async (options: OllamaLibraryFetchOptions = {}): Promise<ModelUpsertRecord[]> => {
  console.log(`Loading Ollama catalog with options:`, options);
  if (!options.refresh) {
    const cachedModels = await listModelsBySource(OLLAMA_MODEL_SOURCE);
    console.log(`Found ${cachedModels.length} cached models for source ${OLLAMA_MODEL_SOURCE}`);

    if (cachedModels.length > 0) {
      return cachedModels;
    }
  }

  return fetchCatalog(options);
};
