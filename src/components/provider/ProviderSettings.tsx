import { Button, useToastNotification } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { deleteProviderChat, deleteProviderEmbedder, fetchProviderModels, updateProviderChat, updateProviderEmbedder, validateProviderModels, verifyProviderEmbedder } from "./provider.client.js";
import type { Provider, ProviderModelValidateResultItem } from "./provider.schema.js";
import { providerEmbedderUpdateSchema } from "./provider.schema.js";

type ProviderSettingsProps = {
  provider: Provider;
  reload: () => void;
};

export function ProviderSettings({ provider, reload }: ProviderSettingsProps) {
  return (
    <div className="p-grid">
      <div className="p-grid__row">
        <div className="p-grid__col-12">
          <ProviderChatSettings provider={provider} reload={reload} />
          <ProviderEmbedderSettings provider={provider} reload={reload} />
        </div>
      </div>
    </div>
  );
}

function ProviderChatSettings({ provider, reload }: ProviderSettingsProps) {
  const toastNotify = useToastNotification();
  const persistedEnabledModels = provider.chat?.enabledModels ?? [];
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
    for (const model of models) if (model.id.trim()) map.set(model.id, model.displayName ?? model.id);
    for (const modelId of persistedEnabledModels) if (!map.has(modelId)) map.set(modelId, modelId);
    if (provider.chat?.defaultModel && !map.has(provider.chat.defaultModel)) map.set(provider.chat.defaultModel, provider.chat.defaultModel);
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [models, persistedEnabledModels, provider.chat?.defaultModel]);

  useEffect(() => {
    setEnabledModels(persistedEnabledModels);
    setDefaultModel(provider.chat?.defaultModel ?? ``);
    setUnavailableModelIds([]);
  }, [provider.id, provider.updatedAt, provider.chat?.updatedAt]);

  const filteredModelOptions = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return query ? modelOptions.filter((model) => model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)) : modelOptions;
  }, [modelOptions, modelSearch]);

  if (!provider.chat) {
    return (
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Chat capability</h2>
        <p>This provider is not available for chat or loop provider assignment.</p>
        <Button
          appearance="positive"
          onClick={() => {
            void updateProviderChat(provider.id, { defaultModel: null, enabledModels: null })
              .then(() => {
                toastNotify.info(`Chat capability has been enabled.`, `Saved`);
                reload();
              })
              .catch((error: unknown) => toastNotify.failure(`Unable to enable chat capability`, error instanceof Error ? error : new Error(String(error))));
          }}
          type="button"
        >
          Enable chat
        </Button>
      </div>
    );
  }

  const loadModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const fetchedModels = await fetchProviderModels(provider.id);
      setModels(fetchedModels);
      if (enabledModels.length === 0 && persistedEnabledModels.length === 0) setEnabledModels(fetchedModels.map((model) => model.id));
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
      if (checked) return current.includes(modelId) ? current : [...current, modelId];
      const next = current.filter((value) => value !== modelId);
      if (defaultModel === modelId) setDefaultModel(next[0] ?? ``);
      return next;
    });
  };

  const validateSelectedModels = async (modelIds: string[]): Promise<ProviderModelValidateResultItem[]> => {
    const uniqueModels = Array.from(new Set(modelIds.map((value) => value.trim()).filter(Boolean)));
    const results: ProviderModelValidateResultItem[] = [];
    for (const model of uniqueModels) {
      const validation = await validateProviderModels(provider.id, [model]);
      const result = validation.results[0] ?? { model, available: false, reason: `Validation returned no result.` };
      results.push(result);
      toastNotify.info(`${results.length}/${uniqueModels.length} validated: ${model}${result.available ? ` (available)` : ` (unavailable)`}`, `Model validation progress`);
    }
    return results;
  };

  const saveModelSettings = async () => {
    if (defaultModel && !enabledModels.includes(defaultModel)) return toastNotify.failure(`Unable to save model settings`, new Error(`Default model must be included in enabled models.`));
    if (enabledModels.length === 0) return toastNotify.failure(`Unable to save model settings`, new Error(`Enable at least one model before saving.`));
    if (!window.confirm(`Before saving, Athena will send one tiny validation request per selected model to verify availability for this API key. Continue?`)) return;

    setIsSaving(true);
    try {
      const validationResults = await validateSelectedModels(enabledModels);
      const unavailable = validationResults.filter((result) => !result.available).map((result) => result.model);
      const sanitizedEnabledModels = enabledModels.filter((modelId) => !unavailable.includes(modelId));
      if (unavailable.length > 0) {
        setUnavailableModelIds(unavailable);
        setEnabledModels(sanitizedEnabledModels);
        if (defaultModel && unavailable.includes(defaultModel)) setDefaultModel(sanitizedEnabledModels[0] ?? ``);
        toastNotify.failure(`Some models are unavailable`, new Error(`Unavailable models were unchecked: ${unavailable.join(`, `)}.`));
        if (sanitizedEnabledModels.length === 0) return;
      } else {
        setUnavailableModelIds([]);
      }

      await updateProviderChat(provider.id, {
        defaultModel: defaultModel && !unavailable.includes(defaultModel) ? defaultModel : (sanitizedEnabledModels[0] ?? null),
        enabledModels: sanitizedEnabledModels.length > 0 ? sanitizedEnabledModels : null,
      });
      toastNotify.info(`Provider model settings have been updated.`, `Saved`);
      reload();
    } catch (error) {
      toastNotify.failure(`Unable to save model settings`, error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-card p-strip is-shallow">
      <h2 className="p-heading--4">Model settings</h2>
      <p className="p-text--small">Chat capability</p>
      <div>
        <Button appearance="base" disabled={isLoadingModels || isSaving} onClick={() => void loadModels()} type="button">
          {isLoadingModels ? `Loading models...` : `Fetch models`}
        </Button>
        <Button appearance="base" disabled={modelOptions.length === 0 || isSaving} onClick={() => setEnabledModels(modelOptions.map((model) => model.id))} type="button">
          Enable all
        </Button>
        <Button
          appearance="base"
          disabled={enabledModels.length === 0 || isSaving}
          onClick={() => {
            setEnabledModels([]);
            setDefaultModel(``);
          }}
          type="button"
        >
          Clear all
        </Button>
      </div>
      {modelsError ? <p className="p-form-validation is-error">{modelsError}</p> : null}
      <label htmlFor="provider-default-model">Default model</label>
      <select
        id="provider-default-model"
        onChange={(event) => {
          const next = event.target.value;
          setDefaultModel(next);
          if (next && !enabledModels.includes(next)) setEnabledModels((current) => [...current, next]);
        }}
        value={defaultModel}
      >
        <option value="">Select a default model</option>
        {enabledModels.map((modelId) => (
          <option key={modelId} value={modelId}>
            {modelOptions.find((model) => model.id === modelId)?.label ?? modelId}
          </option>
        ))}
      </select>
      <p className="p-text--small">Enabled models: {enabledModels.length}</p>
      {modelOptions.length > 0 ? (
        <fieldset>
          <legend>Enabled models</legend>
          <label htmlFor="provider-model-search">Search models</label>
          <input id="provider-model-search" onChange={(event) => setModelSearch(event.target.value)} placeholder="Search by model name or id" type="search" value={modelSearch} />
          {filteredModelOptions.map((model) => (
            <label className="p-checkbox" htmlFor={`provider-enabled-model-${model.id}`} key={model.id}>
              <input checked={enabledModels.includes(model.id)} id={`provider-enabled-model-${model.id}`} onChange={(event) => toggleModel(model.id, event.target.checked)} type="checkbox" />
              <span className="p-checkbox__label">{model.label}</span>
              {unavailableModelIds.includes(model.id) ? <span className="p-form-validation is-error">Unavailable</span> : null}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="u-align--right">
        {provider.embedder ? (
          <Button
            appearance="negative"
            disabled={isSaving}
            onClick={() =>
              void deleteProviderChat(provider.id)
                .then(reload)
                .catch((error: unknown) => toastNotify.failure(`Unable to remove chat capability`, error instanceof Error ? error : new Error(String(error))))
            }
            type="button"
          >
            Remove chat
          </Button>
        ) : null}
        <Button appearance="positive" disabled={isSaving} onClick={() => void saveModelSettings()} type="button">
          {isSaving ? `Saving model settings...` : `Save model settings`}
        </Button>
      </div>
    </div>
  );
}

function ProviderEmbedderSettings({ provider, reload }: ProviderSettingsProps) {
  const toastNotify = useToastNotification();
  const [model, setModel] = useState(provider.embedder?.model ?? ``);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setModel(provider.embedder?.model ?? ``);
  }, [provider.embedder?.updatedAt]);

  const save = async () => {
    const parsed = providerEmbedderUpdateSchema.safeParse({ model });
    if (!parsed.success) return toastNotify.failure(`Unable to save embedder`, new Error(parsed.error.issues[0]?.message ?? `Invalid embedder configuration.`));
    setIsBusy(true);
    try {
      await updateProviderEmbedder(provider.id, parsed.data);
      toastNotify.info(`Embedder capability has been saved.`, `Saved`);
      reload();
    } catch (error) {
      toastNotify.failure(`Unable to save embedder`, error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsBusy(false);
    }
  };

  const verify = async () => {
    setIsBusy(true);
    try {
      const result = await verifyProviderEmbedder(provider.id);
      toastNotify.info(`${result.model} returned ${result.dimensions} dimensions.`, `Embedder verified`);
    } catch (error) {
      toastNotify.failure(`Unable to verify embedder`, error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="p-card p-strip is-shallow">
      <h2 className="p-heading--4">Embedder settings</h2>
      <label htmlFor="provider-embedder-model">Embedding model</label>
      <input id="provider-embedder-model" onChange={(event) => setModel(event.target.value)} type="text" value={model} />
      <div className="u-align--right">
        {provider.embedder ? (
          <Button
            appearance="negative"
            disabled={isBusy || !provider.chat}
            onClick={() =>
              void deleteProviderEmbedder(provider.id)
                .then(reload)
                .catch((error: unknown) => toastNotify.failure(`Unable to remove embedder capability`, error instanceof Error ? error : new Error(String(error))))
            }
            type="button"
          >
            Remove embedder
          </Button>
        ) : null}
        {provider.embedder ? (
          <Button appearance="base" disabled={isBusy} onClick={() => void verify()} type="button">
            Verify embedder
          </Button>
        ) : null}
        <Button appearance="positive" disabled={isBusy} onClick={() => void save()} type="button">
          {provider.embedder ? `Save embedder` : `Enable embedder`}
        </Button>
      </div>
    </div>
  );
}
