import { Button, useToastNotification } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { fetchProviderModels, updateProvider, validateProviderModels } from "./provider.client.js";
import type { Provider, ProviderModelValidateResultItem } from "./provider.schema.js";

type ProviderSettingsProps = {
  provider: Provider;
  reload: () => void;
};

export function ProviderSettings({ provider, reload }: ProviderSettingsProps) {
  const toastNotify = useToastNotification();
  const persistedEnabledModels = provider.enabledModels ?? [];
  const [models, setModels] = useState<Array<{ id: string; displayName?: string }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState(``);
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>(``);
  const [unavailableModelIds, setUnavailableModelIds] = useState<string[]>([]);

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const model of models) {
      if (model.id.trim().length > 0) {
        map.set(model.id, model.displayName ?? model.id);
      }
    }

    for (const modelId of persistedEnabledModels) {
      if (!map.has(modelId)) {
        map.set(modelId, modelId);
      }
    }

    if (provider.defaultModel && !map.has(provider.defaultModel)) {
      map.set(provider.defaultModel, provider.defaultModel);
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [models, persistedEnabledModels, provider.defaultModel]);

  useEffect(() => {
    setEnabledModels(persistedEnabledModels);
    setDefaultModel(provider.defaultModel ?? ``);
    setUnavailableModelIds([]);
  }, [provider.id, provider.updatedAt]);

  const filteredModelOptions = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    if (!query) {
      return modelOptions;
    }

    return modelOptions.filter((model) => model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query));
  }, [modelOptions, modelSearch]);

  const isDirty = defaultModel !== (provider.defaultModel ?? ``) || enabledModels.length !== persistedEnabledModels.length || enabledModels.some((modelId) => !persistedEnabledModels.includes(modelId));

  const loadModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);

    try {
      const fetchedModels = await fetchProviderModels(provider.id);
      setModels(fetchedModels);

      if (enabledModels.length === 0 && persistedEnabledModels.length === 0) {
        setEnabledModels(fetchedModels.map((model) => model.id));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelsError(message);
      toastNotify.failure(`Unable to load models`, error instanceof Error ? error : new Error(message));
    } finally {
      setIsLoadingModels(false);
    }
  };

  const toggleModel = (modelId: string, checked: boolean) => {
    setEnabledModels((current) => {
      if (checked) {
        if (current.includes(modelId)) {
          return current;
        }

        return [...current, modelId];
      }

      const next = current.filter((value) => value !== modelId);

      if (defaultModel === modelId) {
        setDefaultModel(next[0] ?? ``);
      }

      return next;
    });
  };

  const selectAllModels = () => {
    setEnabledModels(modelOptions.map((model) => model.id));

    if (!defaultModel && modelOptions.length > 0) {
      setDefaultModel(modelOptions[0]?.id ?? ``);
    }
  };

  const clearAllModels = () => {
    setEnabledModels([]);
    setDefaultModel(``);
  };

  const validateSelectedModelsWithProgress = async (modelIds: string[]): Promise<ProviderModelValidateResultItem[]> => {
    const uniqueModels = Array.from(new Set(modelIds.map((value) => value.trim()).filter((value) => value.length > 0)));

    if (uniqueModels.length === 0) {
      return [];
    }

    const concurrency = Math.min(6, uniqueModels.length);
    const results: ProviderModelValidateResultItem[] = new Array(uniqueModels.length);
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= uniqueModels.length) {
          return;
        }

        const model = uniqueModels[currentIndex] as string;
        const validation = await validateProviderModels(provider.id, [model]);
        const result = validation.results[0] ?? { model, available: false, reason: `Validation returned no result.` };
        results[currentIndex] = result;

        completed += 1;
        toastNotify.info(`${completed}/${uniqueModels.length} validated: ${model}${result.available ? ` (available)` : ` (unavailable)`}`, `Model validation progress`);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  };

  const saveModelSettings = async () => {
    if (defaultModel && !enabledModels.includes(defaultModel)) {
      toastNotify.failure(`Unable to save model settings`, new Error(`Default model must be included in enabled models.`));
      return;
    }

    if (enabledModels.length === 0) {
      toastNotify.failure(`Unable to save model settings`, new Error(`Enable at least one model before saving.`));
      return;
    }

    const shouldValidate = window.confirm(`Before saving, Athena will send one tiny validation request per selected model to verify availability for this API key. Continue?`);

    if (!shouldValidate) {
      return;
    }

    setIsSaving(true);

    try {
      toastNotify.info(`Starting validation for ${enabledModels.length} selected models.`, `Model validation progress`);
      const validationResults = await validateSelectedModelsWithProgress(enabledModels);
      const unavailable = validationResults.filter((result) => !result.available).map((result) => result.model);

      if (unavailable.length > 0) {
        const nextEnabledModels = enabledModels.filter((modelId) => !unavailable.includes(modelId));

        setUnavailableModelIds(unavailable);
        setEnabledModels(nextEnabledModels);

        if (defaultModel && unavailable.includes(defaultModel)) {
          setDefaultModel(nextEnabledModels[0] ?? ``);
        }

        toastNotify.failure(`Some models are unavailable`, new Error(`Unavailable models were unchecked: ${unavailable.join(`, `)}.`));

        if (nextEnabledModels.length === 0) {
          return;
        }
      } else {
        setUnavailableModelIds([]);
        toastNotify.info(`All ${validationResults.length} selected models are available.`, `Model validation completed`);
      }

      const sanitizedEnabledModels = enabledModels.filter((modelId) => !unavailable.includes(modelId));

      await updateProvider(provider.id, {
        displayName: provider.displayName,
        providerType: provider.providerType,
        baseUrl: provider.baseUrl,
        lifecycleStatus: provider.lifecycleStatus,
        defaultModel: defaultModel && !unavailable.includes(defaultModel) ? defaultModel : (sanitizedEnabledModels[0] ?? null),
        enabledModels: sanitizedEnabledModels.length > 0 ? sanitizedEnabledModels : null,
      });

      toastNotify.info(`Provider model settings have been updated.`, `Saved`);
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastNotify.failure(`Unable to save model settings`, error instanceof Error ? error : new Error(message));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-card p-strip is-shallow">
      <h2 className="p-heading--4">Model settings</h2>
      <div>
        <Button appearance="base" disabled={isLoadingModels || isSaving} onClick={() => void loadModels()} type="button">
          {isLoadingModels ? `Loading models...` : `Fetch models`}
        </Button>
        <Button appearance="base" disabled={modelOptions.length === 0 || isSaving} onClick={selectAllModels} type="button">
          Enable all
        </Button>
        <Button appearance="base" disabled={enabledModels.length === 0 || isSaving} onClick={clearAllModels} type="button">
          Clear all
        </Button>
      </div>
      {modelsError ? <p className="p-form-validation is-error">{modelsError}</p> : null}
      <label htmlFor="provider-default-model">Default model</label>
      <select
        id="provider-default-model"
        onChange={(event) => {
          const nextDefault = event.target.value;
          setDefaultModel(nextDefault);

          if (nextDefault && !enabledModels.includes(nextDefault)) {
            setEnabledModels((current) => [...current, nextDefault]);
          }
        }}
        value={defaultModel}
      >
        <option value="">Select a default model</option>
        {enabledModels.map((modelId) => {
          const option = modelOptions.find((model) => model.id === modelId);

          return (
            <option key={modelId} value={modelId}>
              {option?.label ?? modelId}
            </option>
          );
        })}
      </select>
      <p className="p-text--small">Enabled models: {enabledModels.length}</p>
      {modelOptions.length > 0 ? (
        <fieldset>
          <legend>Enabled models</legend>
          <label htmlFor="provider-model-search">Search models</label>
          <input id="provider-model-search" onChange={(event) => setModelSearch(event.target.value)} placeholder="Search by model name or id" type="search" value={modelSearch} />
          {filteredModelOptions.length > 0 ? (
            filteredModelOptions.map((model) => (
              <div key={model.id}>
                <label htmlFor={`provider-enabled-model-${model.id}`}>
                  <input checked={enabledModels.includes(model.id)} id={`provider-enabled-model-${model.id}`} onChange={(event) => toggleModel(model.id, event.target.checked)} type="checkbox" />
                  {model.label}
                  {unavailableModelIds.includes(model.id) ? <span className="p-chip is-inline u-no-margin--left">Unavailable</span> : null}
                </label>
              </div>
            ))
          ) : (
            <p className="p-text--small">No models match your search.</p>
          )}
        </fieldset>
      ) : (
        <p className="p-text--small">Fetch models to configure the enabled model list with checkboxes.</p>
      )}
      <div className="u-align--right">
        <Button appearance="positive" disabled={!isDirty || isSaving} onClick={() => void saveModelSettings()} type="button">
          {isSaving ? `Saving model settings...` : `Save model settings`}
        </Button>
      </div>
    </div>
  );
}
