import { Button, useToastNotification } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { fetchProviderModels, updateProvider } from "./provider.client.js";
import type { Provider } from "./provider.schema.js";

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

  const saveModelSettings = async () => {
    if (defaultModel && !enabledModels.includes(defaultModel)) {
      toastNotify.failure(`Unable to save model settings`, new Error(`Default model must be included in enabled models.`));
      return;
    }

    setIsSaving(true);

    try {
      await updateProvider(provider.id, {
        displayName: provider.displayName,
        providerType: provider.providerType,
        baseUrl: provider.baseUrl,
        lifecycleStatus: provider.lifecycleStatus,
        defaultModel: defaultModel || null,
        enabledModels: enabledModels.length > 0 ? enabledModels : null,
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
