import { bootstrapDecisionResponseFormat, bootstrapDecisionSchema } from "../bootstrap/bootstrap.schemas.js";
import { getEnvironmentSnapshot } from "../environment/environment.service.js";
import { ollamaClient } from "../ollama/ollama.client.js";
const DEFAULT_BOOTSTRAP_MODEL = process.env.ATHENA_BOOTSTRAP_MODEL ?? `nemotron-3-nano`;
const DEFAULT_MODEL_MEMORY_BUDGET_RATIO = 0.8;
const MAX_MODEL_DECISION_CANDIDATES = 24;
const hasInstalledModel = (installedModelName, expectedModelName) => {
    return installedModelName === expectedModelName || installedModelName.startsWith(`${expectedModelName}:`);
};
const parseByteSize = (size) => {
    if (!size) {
        return null;
    }
    const parsedSize = Number(size);
    if (Number.isFinite(parsedSize)) {
        return parsedSize;
    }
    const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)$/i);
    if (!match) {
        return null;
    }
    const [, rawValue, rawUnit] = match;
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
    return Math.round(value * multiplierByUnit[unit]);
};
const parseBudgetRatio = (value) => {
    if (!value) {
        return DEFAULT_MODEL_MEMORY_BUDGET_RATIO;
    }
    const normalizedValue = value.trim();
    if (!normalizedValue) {
        return DEFAULT_MODEL_MEMORY_BUDGET_RATIO;
    }
    const parsedValue = normalizedValue.endsWith(`%`) ? Number(normalizedValue.slice(0, -1)) / 100 : Number(normalizedValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return DEFAULT_MODEL_MEMORY_BUDGET_RATIO;
    }
    if (parsedValue > 1 && parsedValue <= 100) {
        return parsedValue / 100;
    }
    return Math.min(parsedValue, 1);
};
const getModelCapacityBudget = (snapshot) => {
    const ratio = parseBudgetRatio(snapshot.environmentVariables.athenaModelMemoryBudgetRatio);
    const hasGpu = snapshot.gpu.devices.length > 0;
    const systemMemoryBudgetBytes = Math.floor(snapshot.systemMemory.freeBytes * ratio);
    const gpuMemoryBudgetCandidates = snapshot.gpu.devices
        .map((device) => parseByteSize(device.memoryTotal))
        .filter((memoryBytes) => memoryBytes != null);
    const gpuMemoryBudgetBytes = gpuMemoryBudgetCandidates.length > 0 ? Math.floor(Math.max(...gpuMemoryBudgetCandidates) * ratio) : null;
    return {
        hasGpu,
        ratio,
        systemMemoryBudgetBytes,
        gpuMemoryBudgetBytes,
        effectiveModelBudgetBytes: hasGpu ? Math.min(systemMemoryBudgetBytes, gpuMemoryBudgetBytes ?? systemMemoryBudgetBytes) : systemMemoryBudgetBytes,
    };
};
const isTextOnlyVariant = (catalogModel, variant) => {
    const normalizedSlug = catalogModel.slug.toLowerCase();
    const normalizedName = catalogModel.name.toLowerCase();
    const normalizedInputType = (variant.inputType ?? ``).toLowerCase();
    if (normalizedInputType && normalizedInputType !== `text`) {
        return false;
    }
    return ![normalizedSlug, normalizedName].some((value) => value.includes(`vision`) || value.includes(`vl`) || value.includes(`omni`));
};
const isEmbeddingModel = (catalogModel) => {
    const normalizedSlug = catalogModel.slug.toLowerCase();
    const normalizedName = catalogModel.name.toLowerCase();
    return [normalizedSlug, normalizedName].some((value) => value.includes(`embed`) || value.includes(`embedding`));
};
const isVariantCompatibleWithBudget = (variant, budget) => {
    const modelSizeBytes = parseByteSize(variant.sizeOrUsage);
    if (modelSizeBytes == null || budget.effectiveModelBudgetBytes == null) {
        return true;
    }
    return modelSizeBytes <= budget.effectiveModelBudgetBytes;
};
const scoreCatalogVariant = (catalogModel, variant, budget, bootstrapModel, installedModelNames) => {
    let score = 0;
    const reasons = [];
    const normalizedModelName = catalogModel.name.toLowerCase();
    const normalizedSlug = catalogModel.slug.toLowerCase();
    const normalizedVariantName = variant.name.toLowerCase();
    const modelSizeBytes = parseByteSize(variant.sizeOrUsage);
    const capabilities = catalogModel.capabilities.map((capability) => capability.toLowerCase());
    const installed = Array.from(installedModelNames).some((installedModelName) => hasInstalledModel(installedModelName, variant.name));
    if (normalizedVariantName === bootstrapModel || normalizedVariantName.startsWith(`${bootstrapModel}:`)) {
        score += 15;
        reasons.push(`it is the guaranteed bootstrap model`);
    }
    if (capabilities.includes(`thinking`)) {
        score += 25;
        reasons.push(`the catalog marks it as a thinking-capable model`);
    }
    if (capabilities.includes(`tools`)) {
        score += 10;
        reasons.push(`the catalog marks it as tool-capable`);
    }
    if (normalizedSlug.includes(`deepseek-r1`) || normalizedModelName.includes(`deepseek-r1`)) {
        score += 90;
        reasons.push(`it is a strong reasoning model`);
    }
    else if (normalizedSlug.includes(`qwen3`) ||
        normalizedSlug.includes(`qwen2.5`) ||
        normalizedModelName.includes(`qwen3`) ||
        normalizedModelName.includes(`qwen2.5`)) {
        score += 80;
        reasons.push(`it is a strong general-purpose reasoning family`);
    }
    else if (normalizedSlug.includes(`nemotron-3-nano`) || normalizedModelName.includes(`nemotron-3-nano`)) {
        score += 70;
        reasons.push(`it is a lightweight reasoning-first model`);
    }
    else if (normalizedSlug.includes(`llama3.2`) ||
        normalizedSlug.includes(`llama3`) ||
        normalizedModelName.includes(`llama3.2`) ||
        normalizedModelName.includes(`llama3`)) {
        score += 60;
        reasons.push(`it is a capable text model`);
    }
    else if (normalizedSlug.includes(`gemma3`) ||
        normalizedSlug.includes(`gemma4`) ||
        normalizedSlug.includes(`gemma`) ||
        normalizedModelName.includes(`gemma3`) ||
        normalizedModelName.includes(`gemma4`) ||
        normalizedModelName.includes(`gemma`)) {
        score += 50;
        reasons.push(`it is a capable local model family`);
    }
    if (normalizedSlug.includes(`embed`) ||
        normalizedModelName.includes(`embed`) ||
        normalizedSlug.includes(`embedding`) ||
        normalizedModelName.includes(`embedding`)) {
        score -= 200;
        reasons.push(`it is optimized for embeddings rather than routing decisions`);
    }
    if ((variant.inputType ?? ``).toLowerCase() !== `text`) {
        score -= 20;
        reasons.push(`it is not the most focused option for text-only routing`);
    }
    if (normalizedSlug.includes(`vision`) ||
        normalizedModelName.includes(`vision`) ||
        normalizedSlug.includes(`vl`) ||
        normalizedModelName.includes(`vl`) ||
        normalizedSlug.includes(`omni`) ||
        normalizedModelName.includes(`omni`)) {
        score -= 20;
        reasons.push(`it is not the most focused option for text-only routing`);
    }
    if (installed) {
        score += 15;
        reasons.push(`it is already installed locally`);
    }
    if (variant.isLatest && variant.tag !== `latest`) {
        score += 5;
        reasons.push(`it is the catalog's preferred current variant`);
    }
    if (variant.tag === `latest` && catalogModel.variants.length > 1) {
        score -= 5;
        reasons.push(`an explicit tagged variant is preferable to the generic latest alias`);
    }
    if (modelSizeBytes != null) {
        if (budget.effectiveModelBudgetBytes != null && modelSizeBytes <= budget.effectiveModelBudgetBytes) {
            score += budget.hasGpu ? 20 : 25;
            reasons.push(budget.hasGpu
                ? `its size fits within the GPU and host memory budget derived from the environment`
                : `its size fits within the host memory budget derived from the environment`);
        }
        else if (budget.effectiveModelBudgetBytes != null) {
            score -= budget.hasGpu ? 20 : 60;
            reasons.push(budget.hasGpu
                ? `its size exceeds the GPU or host memory budget derived from the environment`
                : `its size exceeds the host memory budget derived from the environment`);
        }
    }
    return {
        model: variant.name,
        sizeBytes: modelSizeBytes,
        installed,
        score,
        reason: reasons.join(`; `),
    };
};
const filterCompatibleCatalogCandidates = (catalog, budget, bootstrapModel, installedModelNames) => {
    return catalog.models.flatMap((catalogModel) => {
        const variants = catalogModel.variants.length > 0
            ? catalogModel.variants
            : [
                {
                    name: catalogModel.slug,
                    tag: `latest`,
                    href: catalogModel.href,
                    sizeOrUsage: null,
                    contextWindow: null,
                    inputType: `Text`,
                    updated: catalogModel.updated.relative,
                    isLatest: true,
                },
            ];
        if (isEmbeddingModel(catalogModel)) {
            return [];
        }
        return variants
            .filter((variant) => isTextOnlyVariant(catalogModel, variant))
            .filter((variant) => isVariantCompatibleWithBudget(variant, budget))
            .map((variant) => scoreCatalogVariant(catalogModel, variant, budget, bootstrapModel, installedModelNames));
    });
};
const buildModelDecisionPrompt = (snapshot, budget, candidates) => {
    const environmentSummary = {
        hasGpu: budget.hasGpu,
        ratio: budget.ratio,
        freeSystemMemoryBytes: snapshot.systemMemory.freeBytes,
        effectiveModelBudgetBytes: budget.effectiveModelBudgetBytes,
        gpuDevices: snapshot.gpu.devices,
        installedModels: snapshot.ollama.models.map((model) => model.name),
    };
    const candidateSummary = candidates.map((candidate) => ({
        model: candidate.model,
        installed: candidate.installed,
        sizeBytes: candidate.sizeBytes,
        heuristicReason: candidate.reason,
    }));
    return [
        `You are selecting the best local Ollama model for Athena inside a workshop environment.`,
        `Choose exactly one model from the provided candidates.`,
        `Prefer the strongest reasoning-capable text model that is still practical for this environment.`,
        `Return strict JSON with this shape: {"model":"candidate-name","reason":"short explanation"}.`,
        `Do not return markdown fences or any extra text.`,
        `Environment: ${JSON.stringify(environmentSummary)}`,
        `Candidates: ${JSON.stringify(candidateSummary)}`,
    ].join(`\n\n`);
};
const decideModelWithBootstrapModel = async (snapshot, budget, candidates) => {
    if (candidates.length === 0) {
        return null;
    }
    const response = await ollamaClient.generate({
        model: DEFAULT_BOOTSTRAP_MODEL,
        prompt: buildModelDecisionPrompt(snapshot, budget, candidates),
        format: bootstrapDecisionResponseFormat,
        options: {
            temperature: 0,
        },
    });
    const parsedResponse = bootstrapDecisionSchema.safeParse(JSON.parse(response));
    if (!parsedResponse.success) {
        return null;
    }
    const selectedCandidate = candidates.find((candidate) => candidate.model === parsedResponse.data.model);
    if (!selectedCandidate) {
        return null;
    }
    return parsedResponse.data;
};
export const decideBestModelForEnvironment = (snapshot, catalog, installedModels = [], bootstrapModel = DEFAULT_BOOTSTRAP_MODEL) => {
    if (!snapshot) {
        return {
            model: bootstrapModel,
            reason: `environment snapshot is unavailable, so Athena is falling back to the bootstrap model`,
        };
    }
    if (!catalog || catalog.models.length === 0) {
        return {
            model: bootstrapModel,
            reason: `the Ollama catalog is unavailable, so Athena is falling back to the bootstrap model`,
        };
    }
    const installedModelNames = new Set(installedModels.map((model) => model.name.toLowerCase()));
    const budget = getModelCapacityBudget(snapshot);
    const scoredModels = filterCompatibleCatalogCandidates(catalog, budget, bootstrapModel, installedModelNames).sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        if (left.installed !== right.installed) {
            return left.installed ? -1 : 1;
        }
        const leftSize = left.sizeBytes ?? (budget.hasGpu ? 0 : Number.MAX_SAFE_INTEGER);
        const rightSize = right.sizeBytes ?? (budget.hasGpu ? 0 : Number.MAX_SAFE_INTEGER);
        return budget.hasGpu ? rightSize - leftSize : leftSize - rightSize;
    });
    const [bestModel] = scoredModels;
    if (!bestModel) {
        return {
            model: bootstrapModel,
            reason: `Athena could not find a compatible catalog candidate for this environment, so it is falling back to the bootstrap model`,
        };
    }
    return {
        model: bestModel.model,
        reason: `${bestModel.reason || `it is the best fit among the catalog variants`} (${budget.hasGpu ? `GPU` : `CPU-only`} environment, ${Math.round(budget.ratio * 100)}% memory budget)`,
    };
};
/**
 * Coordinates Athena bootstrap steps before model selection and routing begin.
 */
export const bootstrap = async () => {
    let snapshot = null;
    let installedModels = [];
    let catalog = null;
    snapshot = await getEnvironmentSnapshot().catch((error) => {
        console.error(`Failed to inspect Athena workshop environment on startup`, error);
        return null;
    });
    installedModels = snapshot?.ollama.models ?? [];
    try {
        installedModels = await ollamaClient.list();
        const hasBootstrapModel = installedModels.some((model) => hasInstalledModel(model.name, DEFAULT_BOOTSTRAP_MODEL));
        if (!hasBootstrapModel) {
            console.log(`Bootstrap model ${DEFAULT_BOOTSTRAP_MODEL} is not installed. Downloading it now.`);
            await ollamaClient.pull(DEFAULT_BOOTSTRAP_MODEL);
            console.log(`Bootstrap model ${DEFAULT_BOOTSTRAP_MODEL} has been downloaded.`);
            snapshot = await getEnvironmentSnapshot({ refresh: true });
            installedModels = snapshot?.ollama.models ?? installedModels;
        }
    }
    catch (error) {
        console.error(`Failed to ensure Athena bootstrap model is installed`, error);
    }
    try {
        catalog = await ollamaClient.catalog();
    }
    catch (error) {
        console.error(`Failed to load the Ollama catalog for model selection`, error);
    }
    console.log(`We will now decide best model for the environment`);
    const fallbackDecision = decideBestModelForEnvironment(snapshot, catalog, installedModels, DEFAULT_BOOTSTRAP_MODEL);
    let decision = fallbackDecision;
    if (snapshot && catalog) {
        const budget = getModelCapacityBudget(snapshot);
        const installedModelNames = new Set(installedModels.map((model) => model.name.toLowerCase()));
        const compatibleCandidates = filterCompatibleCatalogCandidates(catalog, budget, DEFAULT_BOOTSTRAP_MODEL, installedModelNames);
        const filteredCandidates = compatibleCandidates
            .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            if (left.installed !== right.installed) {
                return left.installed ? -1 : 1;
            }
            const leftSize = left.sizeBytes ?? (budget.hasGpu ? 0 : Number.MAX_SAFE_INTEGER);
            const rightSize = right.sizeBytes ?? (budget.hasGpu ? 0 : Number.MAX_SAFE_INTEGER);
            return budget.hasGpu ? rightSize - leftSize : leftSize - rightSize;
        })
            .slice(0, MAX_MODEL_DECISION_CANDIDATES);
        console.log(`Athena found ${compatibleCandidates.length} compatible catalog candidates and will ask ${DEFAULT_BOOTSTRAP_MODEL} to choose from the top ${filteredCandidates.length}.`);
        try {
            const modelDecision = await decideModelWithBootstrapModel(snapshot, budget, filteredCandidates);
            if (modelDecision) {
                decision = modelDecision;
            }
        }
        catch (error) {
            console.error(`Failed to let the bootstrap model choose from the compatible candidates`, error);
        }
    }
    if (!installedModels.some((model) => hasInstalledModel(model.name, decision.model))) {
        console.log(`Selected model ${decision.model} is not installed. Downloading it now.`);
        await ollamaClient.pull(decision.model);
        console.log(`Selected model ${decision.model} has been downloaded.`);
        snapshot = await getEnvironmentSnapshot({ refresh: true });
        installedModels = snapshot?.ollama.models ?? installedModels;
    }
    console.log(`Athena selected ${decision.model} because ${decision.reason}.`);
    return decision;
};
//# sourceMappingURL=bootstrap.service.js.map