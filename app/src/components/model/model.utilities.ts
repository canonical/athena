import type { WorkshopEnvironmentSnapshot } from "@components/environment/environment.schemas.js";
import type { ModelUpsertRecord } from "@components/model/model.schemas.js";

const ESTIMATED_BYTES_PER_PARAMETER = 2;
const ESTIMATED_CHARACTERS_PER_TOKEN = 3;
const MAX_README_TOKENS_PER_MODEL = 200;
const MAX_README_CHARACTERS_PER_MODEL = ESTIMATED_CHARACTERS_PER_TOKEN * MAX_README_TOKENS_PER_MODEL;
const MINIMUM_CONTEXT_TOKENS = 128_000;
const MINIMUM_MODEL_SIZE_BYTES = 512 * 1024 * 1024;
const ALLOWED_CAPABILITIES = new Set([`thinking`, `tools`]);

const hasNumericSizePrefix = (size: string | null) => {
  return /^\s*\d/.test(size ?? ``);
};

const isEmbeddingModel = (model: ModelUpsertRecord) => {
  const normalizedSlug = model.slug.toLowerCase();
  const normalizedSummary = model.summary?.toLowerCase() ?? ``;
  const normalizedCapabilities = model.capabilities.map((capability) => capability.toLowerCase());

  return (
    [normalizedSlug, normalizedSummary].some((value) => value.includes(`embed`) || value.includes(`embedding`) || value.includes(`minilm`)) ||
    normalizedCapabilities.some((capability) => capability.includes(`embed`) || capability.includes(`embedding`))
  );
};

const isTextOnlyModel = (model: ModelUpsertRecord) => {
  return model.inputTypes.some((inputType) => inputType.toLowerCase() === `text`);
};

const isVisionModel = (model: ModelUpsertRecord) => {
  const normalizedSlug = model.slug.toLowerCase();
  const normalizedSummary = model.summary?.toLowerCase() ?? ``;
  const normalizedInputTypes = model.inputTypes.map((inputType) => inputType.toLowerCase());

  return (
    [normalizedSlug, normalizedSummary].some((value) => value.includes(`vision`) || value.includes(`vl`) || value.includes(`omni`)) ||
    normalizedInputTypes.some((inputType) => inputType !== `text`)
  );
};

const hasMinimumContextWindow = (model: ModelUpsertRecord) => {
  return (model.contextTokens ?? 0) >= MINIMUM_CONTEXT_TOKENS;
};

const hasAllowedCapability = (model: ModelUpsertRecord) => {
  return model.capabilities.some((capability) => ALLOWED_CAPABILITIES.has(capability.toLowerCase()));
};

const parseByteSize = (size: string | null) => {
  if (!size) {
    return null;
  }

  const normalizedSize = size.trim();
  const parsedSize = Number(normalizedSize);

  if (Number.isFinite(parsedSize)) {
    return parsedSize;
  }

  const byteSizeMatch = normalizedSize.match(/^(\d+(?:\.\d+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)$/i);

  if (byteSizeMatch) {
    const [, rawValue, rawUnit] = byteSizeMatch;
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      return null;
    }

    const unit = rawUnit.toUpperCase();
    const multiplierByUnit = {
      B: 1,
      KB: 1024,
      KIB: 1024,
      MB: 1024 ** 2,
      MIB: 1024 ** 2,
      GB: 1024 ** 3,
      GIB: 1024 ** 3,
      TB: 1024 ** 4,
      TIB: 1024 ** 4,
    };

    return Math.round(value * multiplierByUnit[unit as keyof typeof multiplierByUnit]);
  }

  const parameterCountMatch = normalizedSize.match(/^(\d+(?:\.\d+)?)\s*(K|M|B|T)$/i);

  if (!parameterCountMatch) {
    return null;
  }

  const [, rawValue, rawUnit] = parameterCountMatch;
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return null;
  }

  const unit = rawUnit.toUpperCase();
  const multiplierByUnit = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
    T: 1_000_000_000_000,
  };

  return Math.round(value * multiplierByUnit[unit as keyof typeof multiplierByUnit] * ESTIMATED_BYTES_PER_PARAMETER);
};

const truncateText = (value: string | null, maxCharacters: number) => {
  if (!value) {
    return value;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length <= maxCharacters) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxCharacters - 3)).trimEnd()}...`;
};
type ModelWithSizeBytes = ModelUpsertRecord & {
  modelSizeBytes: number | null;
};

/**
 * Filters Athena catalog rows before bootstrap model selection.
 */
export const filterCatalogModels = (catalog: ModelUpsertRecord[], environmentSnapshot: WorkshopEnvironmentSnapshot): ModelUpsertRecord[] => {
  const hasGpu = environmentSnapshot.gpu.devices.length > 0;
  const gpuMemoryCandidates = environmentSnapshot.gpu.devices
    .map((device) => parseByteSize(device.memoryTotal))
    .filter((memoryBytes): memoryBytes is number => memoryBytes != null);
  const maxGpuMemoryBytes = gpuMemoryCandidates.length > 0 ? Math.max(...gpuMemoryCandidates) : null;
  const memoryBudgetBytes = Math.floor(environmentSnapshot.systemMemory.totalBytes * 0.5);

  return catalog
    .filter((model) => hasNumericSizePrefix(model.size))
    .filter((model) => !isEmbeddingModel(model))
    .filter((model) => isTextOnlyModel(model))
    .filter((model) => !isVisionModel(model))
    .filter((model) => hasMinimumContextWindow(model))
    .filter((model) => hasAllowedCapability(model))
    .map(
      (model): ModelWithSizeBytes => ({
        ...model,
        modelSizeBytes: parseByteSize(model.size),
      }),
    )
    .filter((model): model is ModelUpsertRecord & { modelSizeBytes: number } => model.modelSizeBytes != null)
    .filter((model) => model.modelSizeBytes >= MINIMUM_MODEL_SIZE_BYTES)
    .filter((model) => !hasGpu || maxGpuMemoryBytes == null || model.modelSizeBytes <= maxGpuMemoryBytes)
    .filter((model) => hasGpu || model.modelSizeBytes <= memoryBudgetBytes)
    .map(({ modelSizeBytes, ...model }) => ({
      ...model,
      readmeMarkdown: truncateText(model.readmeMarkdown, MAX_README_CHARACTERS_PER_MODEL),
    }));
};
