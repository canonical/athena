import { type BootstrapDecision, bootstrapDecisionSchema } from "@components/bootstrap/bootstrap.schemas.js";
import { parseResponse } from "@components/chat/chat.utilities.js";
import { config } from "@components/config/config.js";
import { getEnvironmentSnapshot } from "@components/environment/environment.service.js";
import { filterCatalogModels } from "@components/model/model.utilities.js";
import { ollamaClient } from "@components/ollama/ollama.client.js";

const hasInstalledModel = (installedModelName: string, expectedModelName: string) => {
  return installedModelName === expectedModelName || installedModelName.startsWith(`${expectedModelName}:`);
};

/**
 * Warm the bootstrap model and let it choose the best Athena model for this machine.
 */
export const bootstrap = async (): Promise<BootstrapDecision | null> => {
  console.log(`Athena is bootstrapping...`);

  const snapshot = await getEnvironmentSnapshot();

  console.log(
    `Athena environment: ${snapshot.gpu.devices.length > 0 ? `GPU` : `CPU-only`} host, ${snapshot.gpu.devices.length} GPU devices, ${snapshot.ollama.models.length} installed Ollama models.`,
  );

  const catalog = new Map((await ollamaClient.catalog()).map((model) => [model.slug, model]));
  console.log(`Athena loaded ${catalog.size} catalog rows.`);

  console.log(`Athena bootstrap model is ${config.ollama.bootstrapModel}.`);

  if (!snapshot.ollama.models.some((model) => hasInstalledModel(model.name, config.ollama.bootstrapModel))) {
    console.log(`Bootstrap model ${config.ollama.bootstrapModel} is not installed. Downloading it now.`);
    await ollamaClient.pull(config.ollama.bootstrapModel);
    console.log(`Bootstrap model ${config.ollama.bootstrapModel} has been downloaded.`);
  }

  const bootstrapModelCatalogEntry = catalog.get(config.ollama.bootstrapModel);
  const bootstrapModelContextTokens = bootstrapModelCatalogEntry?.contextTokens ?? null;
  const athenaPersona = config.personas[`athena.persona.md`] ?? ``;

  const greeting = await ollamaClient.generate({
    model: config.ollama.bootstrapModel,
    prompt: `Say hello in one short sentence.`,
    options: {
      temperature: 0.7,
      ...(bootstrapModelContextTokens != null ? { num_ctx: bootstrapModelContextTokens / 16 } : {}),
    },
  });

  console.log(`Bootstrap model ${config.ollama.bootstrapModel} says: ${greeting}`);

  const catalogRows = filterCatalogModels(Array.from(catalog.values()), snapshot);
  console.log(`Athena filtered catalog down to ${catalogRows.length} rows.`);

  if (catalogRows.length === 0) {
    console.log(`Athena catalog is empty. No model can be selected.`);
    return null;
  }

  const modelSelectionResponse = await ollamaClient.generate({
    model: config.ollama.bootstrapModel,
    system: athenaPersona,
    prompt: [
      `Choose the single best fitting model from the catalog for Athena on this machine.`,
      `Prefer the strongest reasoning model that still fits the current environment and constraints.`,
      `If a GPU is available, prefer a model that fully fits in GPU memory without CPU offload.`,
      `Also consider context window size while calculating memory constraints.`,
      `Do not choose a larger model that spills inference onto the CPU when a fully GPU-fitting reasoning model is available.`,
      `Important: Return only one JSON object with this exact shape: {"slug":"model-slug","reason":"short explanation"}.`,
      `Do not return markdown fences or any extra text.`,
      `Environment snapshot: ${JSON.stringify(snapshot)}`,
      `Catalog: ${JSON.stringify(catalogRows)}`,
    ].join(`\n\n`),
    options: {
      temperature: 0.7,
      ...(bootstrapModelContextTokens != null ? { num_ctx: bootstrapModelContextTokens / 16 } : {}),
    },
  });

  const modelSelection = parseResponse(modelSelectionResponse, bootstrapDecisionSchema);

  if (!modelSelection) {
    console.warn(`Bootstrap model ${config.ollama.bootstrapModel} returned an invalid selection: ${modelSelectionResponse}`);
    return null;
  }

  console.log(`Bootstrap model ${config.ollama.bootstrapModel} selected ${modelSelection.slug}: ${modelSelection.reason}`);

  console.log(`Athena will now say hello with selected model ${modelSelection.slug} to verify it works.`);

  const selectedModelGreeting = await ollamaClient.generate({
    model: modelSelection.slug,
    prompt: `Say hello in one short sentence.`,
    options: {
      temperature: 0.7,
      num_ctx: 512,
    },
  });

  console.log(`Selected model ${modelSelection.slug} says: ${selectedModelGreeting}`);

  return modelSelection;
};
