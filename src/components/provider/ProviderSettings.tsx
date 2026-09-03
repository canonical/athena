import { Button, useToastNotification } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { fetchProviderModels, updateProvider, validateProviderModels } from "./provider.client.js";
import type { Provider, ProviderCapability, ProviderModel, ProviderModelValidateResultItem } from "./provider.schema.js";

type ProviderSettingsProps = {
  provider: Provider;
  reload: () => void;
};

export function ProviderSettings({ provider, reload }: ProviderSettingsProps) {
  const toastNotify = useToastNotification();
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [hasFetchedModels, setHasFetchedModels] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [chatModelSearch, setChatModelSearch] = useState(``);
  const [embeddingModelSearch, setEmbeddingModelSearch] = useState(``);
  const [chatEnabledModels, setChatEnabledModels] = useState<string[]>([]);
  const [chatDefaultModel, setChatDefaultModel] = useState<string>(``);
  const [embeddingEnabledModels, setEmbeddingEnabledModels] = useState<string[]>([]);
  const [embeddingDefaultModel, setEmbeddingDefaultModel] = useState<string>(``);
  const [chatUnavailableModelIds, setChatUnavailableModelIds] = useState<string[]>([]);
  const [embeddingUnavailableModelIds, setEmbeddingUnavailableModelIds] = useState<string[]>([]);

  const persistedChatEnabledModels = provider.chatEnabledModels ?? [];
  const persistedChatDefaultModel = provider.chatDefaultModel ?? ``;
  const persistedEmbeddingEnabledModels = provider.embeddingEnabledModels ?? [];
  const persistedEmbeddingDefaultModel = provider.embeddingDefaultModel ?? ``;

  const modelLabelById = useMemo(() => {
    const map = new Map<string, string>();

    for (const model of models) {
      const modelId = model.id.trim();

      if (modelId.length > 0) {
        map.set(modelId, model.displayName ?? modelId);
      }
    }

    return map;
  }, [models]);

  const buildModelOptionsForCapability = (capability: ProviderCapability): Array<{ id: string; label: string }> => {
    const ids = new Set<string>();

    for (const model of models) {
      const modelId = model.id.trim();

      if (modelId.length === 0) {
        continue;
      }

      if (model.capabilities.includes(capability)) {
        ids.add(modelId);
      }
    }

    const persistedEnabled = capability === `chat` ? persistedChatEnabledModels : persistedEmbeddingEnabledModels;
    const persistedDefault = capability === `chat` ? persistedChatDefaultModel : persistedEmbeddingDefaultModel;

    for (const modelId of persistedEnabled) {
      const trimmedModelId = modelId.trim();

      if (trimmedModelId.length > 0) {
        ids.add(trimmedModelId);
      }
    }

    if (persistedDefault.trim().length > 0) {
      ids.add(persistedDefault.trim());
    }

    return Array.from(ids)
      .map((id) => ({ id, label: modelLabelById.get(id) ?? id }))
      .sort((left, right) => left.label.localeCompare(right.label));
  };

  const chatModelOptions = useMemo(() => buildModelOptionsForCapability(`chat`), [modelLabelById, models, persistedChatDefaultModel, persistedChatEnabledModels]);
  const embeddingModelOptions = useMemo(() => buildModelOptionsForCapability(`embedding`), [modelLabelById, models, persistedEmbeddingDefaultModel, persistedEmbeddingEnabledModels]);

  useEffect(() => {
    setChatEnabledModels(persistedChatEnabledModels);
    setChatDefaultModel(persistedChatDefaultModel);
    setEmbeddingEnabledModels(persistedEmbeddingEnabledModels);
    setEmbeddingDefaultModel(persistedEmbeddingDefaultModel);
    setChatUnavailableModelIds([]);
    setEmbeddingUnavailableModelIds([]);
    setChatModelSearch(``);
    setEmbeddingModelSearch(``);
    setHasFetchedModels(false);
    setModels([]);
    setModelsError(null);
  }, [provider.id, provider.updatedAt]);

  const filterModelOptions = (options: Array<{ id: string; label: string }>, searchText: string): Array<{ id: string; label: string }> => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options.filter((model) => model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query));
  };

  const filteredChatModelOptions = useMemo(() => filterModelOptions(chatModelOptions, chatModelSearch), [chatModelOptions, chatModelSearch]);
  const filteredEmbeddingModelOptions = useMemo(() => filterModelOptions(embeddingModelOptions, embeddingModelSearch), [embeddingModelOptions, embeddingModelSearch]);

  const hasSameValues = (left: string[], right: string[]): boolean => left.length === right.length && left.every((value) => right.includes(value));

  const isDirty =
    chatDefaultModel !== persistedChatDefaultModel ||
    embeddingDefaultModel !== persistedEmbeddingDefaultModel ||
    !hasSameValues(chatEnabledModels, persistedChatEnabledModels) ||
    !hasSameValues(embeddingEnabledModels, persistedEmbeddingEnabledModels);

  const loadModels = async () => {
    if (hasFetchedModels) {
      return;
    }

    setIsLoadingModels(true);
    setModelsError(null);

    try {
      const fetchedModels = await fetchProviderModels(provider.id);
      setModels(fetchedModels);
      setHasFetchedModels(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelsError(message);
      toastNotify.failure(`Unable to load models`, error instanceof Error ? error : new Error(message));
    } finally {
      setIsLoadingModels(false);
    }
  };

  const toggleModel = (capability: ProviderCapability, modelId: string, checked: boolean) => {
    const setEnabled = capability === `chat` ? setChatEnabledModels : setEmbeddingEnabledModels;
    const currentDefaultModel = capability === `chat` ? chatDefaultModel : embeddingDefaultModel;
    const setDefault = capability === `chat` ? setChatDefaultModel : setEmbeddingDefaultModel;

    setEnabled((current) => {
      if (checked) {
        if (current.includes(modelId)) {
          return current;
        }

        return [...current, modelId];
      }

      const next = current.filter((value) => value !== modelId);

      if (currentDefaultModel === modelId) {
        setDefault(``);
      }

      return next;
    });
  };

  const selectAllModels = (capability: ProviderCapability) => {
    if (capability === `chat`) {
      setChatEnabledModels(chatModelOptions.map((model) => model.id));
      return;
    }

    setEmbeddingEnabledModels(embeddingModelOptions.map((model) => model.id));
  };

  const clearAllModels = (capability: ProviderCapability) => {
    if (capability === `chat`) {
      setChatEnabledModels([]);
      setChatDefaultModel(``);
      return;
    }

    setEmbeddingEnabledModels([]);
    setEmbeddingDefaultModel(``);
  };

  const validateSelectedModelsWithProgress = async (capability: ProviderCapability, modelIds: string[]): Promise<ProviderModelValidateResultItem[]> => {
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
        const validation = await validateProviderModels(provider.id, capability, [model]);
        const result = validation.results[0] ?? { model, available: false, reason: `Validation returned no result.` };
        results[currentIndex] = result;

        completed += 1;
        const capabilityLabel = capability === `chat` ? `Chat` : `Embedding`;
        toastNotify.info(`${completed}/${uniqueModels.length} validated for ${capabilityLabel}: ${model}${result.available ? ` (available)` : ` (unavailable)`}`, `Model validation progress`);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  };

  const saveModelSettings = async () => {
    if (chatDefaultModel && !chatEnabledModels.includes(chatDefaultModel)) {
      toastNotify.failure(`Unable to save model settings`, new Error(`Default model must be included in enabled models.`));
      return;
    }

    if (embeddingDefaultModel && !embeddingEnabledModels.includes(embeddingDefaultModel)) {
      toastNotify.failure(`Unable to save model settings`, new Error(`Default model must be included in enabled models.`));
      return;
    }

    const totalSelectedModels = chatEnabledModels.length + embeddingEnabledModels.length;

    const shouldValidate = window.confirm(`Before saving, Athena will send one tiny validation request per selected model to verify availability for this API key. Continue?`);

    if (!shouldValidate) {
      return;
    }

    setIsSaving(true);

    try {
      toastNotify.info(`Starting validation for ${totalSelectedModels} selected models.`, `Model validation progress`);
      const [chatValidationResults, embeddingValidationResults] = await Promise.all([validateSelectedModelsWithProgress(`chat`, chatEnabledModels), validateSelectedModelsWithProgress(`embedding`, embeddingEnabledModels)]);
      const unavailableChatModels = chatValidationResults.filter((result) => !result.available).map((result) => result.model);
      const unavailableEmbeddingModels = embeddingValidationResults.filter((result) => !result.available).map((result) => result.model);

      const sanitizedChatEnabledModels = chatEnabledModels.filter((modelId) => !unavailableChatModels.includes(modelId));
      const sanitizedEmbeddingEnabledModels = embeddingEnabledModels.filter((modelId) => !unavailableEmbeddingModels.includes(modelId));

      setChatUnavailableModelIds(unavailableChatModels);
      setEmbeddingUnavailableModelIds(unavailableEmbeddingModels);

      if (unavailableChatModels.length > 0) {
        setChatEnabledModels(sanitizedChatEnabledModels);

        if (chatDefaultModel && unavailableChatModels.includes(chatDefaultModel)) {
          setChatDefaultModel(``);
        }
      }

      if (unavailableEmbeddingModels.length > 0) {
        setEmbeddingEnabledModels(sanitizedEmbeddingEnabledModels);

        if (embeddingDefaultModel && unavailableEmbeddingModels.includes(embeddingDefaultModel)) {
          setEmbeddingDefaultModel(``);
        }
      }

      if (unavailableChatModels.length > 0 || unavailableEmbeddingModels.length > 0) {
        const unavailableByCapability: string[] = [];

        if (unavailableChatModels.length > 0) {
          unavailableByCapability.push(`Chat: ${unavailableChatModels.join(`, `)}`);
        }

        if (unavailableEmbeddingModels.length > 0) {
          unavailableByCapability.push(`Embedding: ${unavailableEmbeddingModels.join(`, `)}`);
        }

        toastNotify.failure(`Some models are unavailable`, new Error(`Unavailable models were unchecked: ${unavailableByCapability.join(`; `)}.`));
      } else {
        toastNotify.info(`All ${chatValidationResults.length + embeddingValidationResults.length} selected models are available.`, `Model validation completed`);
      }

      await updateProvider(provider.id, {
        displayName: provider.displayName,
        providerType: provider.providerType,
        baseUrl: provider.baseUrl,
        lifecycleStatus: provider.lifecycleStatus,
        chatDefaultModel: chatDefaultModel && !unavailableChatModels.includes(chatDefaultModel) ? chatDefaultModel : null,
        chatEnabledModels: sanitizedChatEnabledModels.length > 0 ? sanitizedChatEnabledModels : null,
        embeddingDefaultModel: embeddingDefaultModel && !unavailableEmbeddingModels.includes(embeddingDefaultModel) ? embeddingDefaultModel : null,
        embeddingEnabledModels: sanitizedEmbeddingEnabledModels.length > 0 ? sanitizedEmbeddingEnabledModels : null,
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
      </div>
      {modelsError ? <p className="p-form-validation is-error">{modelsError}</p> : null}
      <section aria-label="Chat model settings">
        <h3 className="p-heading--5">Chat</h3>
        <div>
          <Button appearance="base" disabled={chatModelOptions.length === 0 || isSaving} onClick={() => selectAllModels(`chat`)} type="button">
            Enable all Chat models
          </Button>
          <Button appearance="base" disabled={chatEnabledModels.length === 0 || isSaving} onClick={() => clearAllModels(`chat`)} type="button">
            Clear all Chat models
          </Button>
        </div>
        <label htmlFor="provider-chat-default-model">Default Chat model</label>
        <select
          id="provider-chat-default-model"
          onChange={(event) => {
            setChatDefaultModel(event.target.value);
          }}
          value={chatDefaultModel}
        >
          <option value="">Select a default Chat model</option>
          {chatEnabledModels.map((modelId) => {
            const option = chatModelOptions.find((model) => model.id === modelId);

            return (
              <option key={modelId} value={modelId}>
                {option?.label ?? modelId}
              </option>
            );
          })}
        </select>
        <p className="p-text--small">Enabled Chat models: {chatEnabledModels.length}</p>
        {chatModelOptions.length > 0 ? (
          <fieldset>
            <legend>Enabled Chat models</legend>
            <label htmlFor="provider-chat-model-search">Search Chat models</label>
            <input id="provider-chat-model-search" onChange={(event) => setChatModelSearch(event.target.value)} placeholder="Search by model name or id" type="search" value={chatModelSearch} />
            {filteredChatModelOptions.length > 0 ? (
              filteredChatModelOptions.map((model) => (
                <div key={model.id}>
                  <label htmlFor={`provider-chat-enabled-model-${model.id}`}>
                    <input checked={chatEnabledModels.includes(model.id)} id={`provider-chat-enabled-model-${model.id}`} onChange={(event) => toggleModel(`chat`, model.id, event.target.checked)} type="checkbox" />
                    {model.label}
                    {chatUnavailableModelIds.includes(model.id) ? <span className="p-chip is-inline u-no-margin--left">Unavailable</span> : null}
                  </label>
                </div>
              ))
            ) : (
              <p className="p-text--small">No Chat models match your search.</p>
            )}
          </fieldset>
        ) : (
          <p className="p-text--small">Fetch models to configure Chat model settings.</p>
        )}
      </section>
      <section aria-label="Embedding model settings">
        <h3 className="p-heading--5">Embeddings</h3>
        <div>
          <Button appearance="base" disabled={embeddingModelOptions.length === 0 || isSaving} onClick={() => selectAllModels(`embedding`)} type="button">
            Enable all Embedding models
          </Button>
          <Button appearance="base" disabled={embeddingEnabledModels.length === 0 || isSaving} onClick={() => clearAllModels(`embedding`)} type="button">
            Clear all Embedding models
          </Button>
        </div>
        <label htmlFor="provider-embedding-default-model">Default Embedding model</label>
        <select
          id="provider-embedding-default-model"
          onChange={(event) => {
            setEmbeddingDefaultModel(event.target.value);
          }}
          value={embeddingDefaultModel}
        >
          <option value="">Select a default Embedding model</option>
          {embeddingEnabledModels.map((modelId) => {
            const option = embeddingModelOptions.find((model) => model.id === modelId);

            return (
              <option key={modelId} value={modelId}>
                {option?.label ?? modelId}
              </option>
            );
          })}
        </select>
        <p className="p-text--small">Enabled Embedding models: {embeddingEnabledModels.length}</p>
        {embeddingModelOptions.length > 0 ? (
          <fieldset>
            <legend>Enabled Embedding models</legend>
            <label htmlFor="provider-embedding-model-search">Search Embedding models</label>
            <input id="provider-embedding-model-search" onChange={(event) => setEmbeddingModelSearch(event.target.value)} placeholder="Search by model name or id" type="search" value={embeddingModelSearch} />
            {filteredEmbeddingModelOptions.length > 0 ? (
              filteredEmbeddingModelOptions.map((model) => (
                <div key={model.id}>
                  <label htmlFor={`provider-embedding-enabled-model-${model.id}`}>
                    <input checked={embeddingEnabledModels.includes(model.id)} id={`provider-embedding-enabled-model-${model.id}`} onChange={(event) => toggleModel(`embedding`, model.id, event.target.checked)} type="checkbox" />
                    {model.label}
                    {embeddingUnavailableModelIds.includes(model.id) ? <span className="p-chip is-inline u-no-margin--left">Unavailable</span> : null}
                  </label>
                </div>
              ))
            ) : (
              <p className="p-text--small">No Embedding models match your search.</p>
            )}
          </fieldset>
        ) : (
          <p className="p-text--small">Fetch models to configure Embedding model settings.</p>
        )}
      </section>
      <div className="u-align--right">
        <Button appearance="positive" disabled={!isDirty || isSaving} onClick={() => void saveModelSettings()} type="button">
          {isSaving ? `Saving model settings...` : `Save model settings`}
        </Button>
      </div>
    </div>
  );
}
