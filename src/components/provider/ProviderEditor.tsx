import { Button, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import type { z } from "zod";
import { createProvider, updateProvider } from "./provider.client.js";
import type { Provider } from "./provider.schema.js";
import { providerInsertSchema, providerLifecycleStatuses, providerTypes, providerUpdateSchema } from "./provider.schema.js";

type ProviderEditorProps = {
  provider?: Provider;
  onSuccess: (title: string, message: string) => void;
  onDelete?: (provider: Provider) => Promise<void>;
  isDeleting?: boolean;
};

const lifecycleLabel: Record<(typeof providerLifecycleStatuses)[number], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type ProviderFormValues = {
  displayName: string;
  providerType: (typeof providerTypes)[number];
  baseUrl: string;
  apiKey: string;
  lifecycleStatus: (typeof providerLifecycleStatuses)[number];
  chatEnabled: boolean;
  embedderEnabled: boolean;
  embeddingModel: string;
};

const toFormikErrors = (error: z.ZodError, values: ProviderFormValues): Partial<Record<keyof ProviderFormValues, string>> => {
  const errors: Partial<Record<keyof ProviderFormValues, string>> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (typeof key === `string` && key in values && !errors[key as keyof ProviderFormValues]) {
      errors[key as keyof ProviderFormValues] = issue.message;
    }
  }

  return errors;
};

export function ProviderEditor({ provider, onSuccess, onDelete, isDeleting = false }: ProviderEditorProps) {
  const isEdit = Boolean(provider);
  const toastNotify = useToastNotification();

  const parseProviderFormValues = (values: ProviderFormValues) => {
    if (isEdit) {
      return providerUpdateSchema.safeParse({
        displayName: values.displayName,
        providerType: values.providerType,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey || undefined,
        lifecycleStatus: values.lifecycleStatus,
      });
    }

    return providerInsertSchema.safeParse({
      displayName: values.displayName,
      providerType: values.providerType,
      baseUrl: values.baseUrl,
      apiKey: values.apiKey,
      lifecycleStatus: values.lifecycleStatus,
      chat: values.chatEnabled ? { defaultModel: null, enabledModels: null } : null,
      embedder: values.embedderEnabled ? { model: values.embeddingModel } : null,
    });
  };

  const parseProviderInsertFormValues = (values: ProviderFormValues) =>
    providerInsertSchema.safeParse({
      displayName: values.displayName,
      providerType: values.providerType,
      baseUrl: values.baseUrl,
      apiKey: values.apiKey,
      lifecycleStatus: values.lifecycleStatus,
      chat: values.chatEnabled ? { defaultModel: null, enabledModels: null } : null,
      embedder: values.embedderEnabled ? { model: values.embeddingModel } : null,
    });

  const parseProviderUpdateFormValues = (values: ProviderFormValues) =>
    providerUpdateSchema.safeParse({
      displayName: values.displayName,
      providerType: values.providerType,
      baseUrl: values.baseUrl,
      apiKey: values.apiKey || undefined,
      lifecycleStatus: values.lifecycleStatus,
    });

  const formik = useFormik<ProviderFormValues>({
    enableReinitialize: true,
    initialValues: {
      displayName: provider?.displayName ?? ``,
      providerType: provider?.providerType ?? `openrouter`,
      baseUrl: provider?.baseUrl ?? `https://openrouter.ai/api/v1`,
      apiKey: ``,
      lifecycleStatus: provider?.lifecycleStatus ?? `active`,
      chatEnabled: provider ? provider.chat !== null : true,
      embedderEnabled: provider ? provider.embedder !== null : false,
      embeddingModel: provider?.embedder?.model ?? ``,
    },
    validate: (values) => {
      const parseResult = parseProviderFormValues(values);

      if (parseResult.success) {
        return {};
      }

      return toFormikErrors(parseResult.error, values);
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      try {
        if (provider) {
          const parseResult = parseProviderUpdateFormValues(values);

          if (!parseResult.success) {
            toastNotify.failure(`Unable to update provider`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
            return;
          }

          const savedProvider = await updateProvider(provider.id, parseResult.data);
          onSuccess(`Provider updated`, `${savedProvider.displayName} has been updated.`);
          return;
        }

        const parseResult = parseProviderInsertFormValues(values);

        if (!parseResult.success) {
          toastNotify.failure(`Unable to create provider`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
          return;
        }

        const savedProvider = await createProvider(parseResult.data);
        onSuccess(`Provider created`, `${savedProvider.displayName} has been created.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update provider` : `Unable to create provider`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="provider-editor-display-name">Display name</label>
      <input id="provider-editor-display-name" required type="text" {...formik.getFieldProps(`displayName`)} />
      {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}
      <label htmlFor="provider-editor-type">Provider type</label>
      <select id="provider-editor-type" {...formik.getFieldProps(`providerType`)}>
        {providerTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <label htmlFor="provider-editor-base-url">Base URL</label>
      <input id="provider-editor-base-url" required type="url" {...formik.getFieldProps(`baseUrl`)} />
      {formik.touched.baseUrl && formik.errors.baseUrl ? <p className="p-form-validation is-error">{formik.errors.baseUrl}</p> : null}
      <label htmlFor="provider-editor-api-key">{isEdit ? `API key (optional for rotation)` : `API key`}</label>
      <input id="provider-editor-api-key" required={!isEdit} type="password" {...formik.getFieldProps(`apiKey`)} />
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
      <label htmlFor="provider-editor-lifecycle-status">Lifecycle status</label>
      <select id="provider-editor-lifecycle-status" {...formik.getFieldProps(`lifecycleStatus`)}>
        {providerLifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>
      {!isEdit ? (
        <>
          <fieldset>
            <legend>Capabilities</legend>
            <label className="p-checkbox" htmlFor="provider-editor-chat-enabled">
              <input id="provider-editor-chat-enabled" type="checkbox" {...formik.getFieldProps(`chatEnabled`)} checked={formik.values.chatEnabled} />
              <span className="p-checkbox__label">Chat</span>
            </label>
            <label className="p-checkbox" htmlFor="provider-editor-embedder-enabled">
              <input id="provider-editor-embedder-enabled" type="checkbox" {...formik.getFieldProps(`embedderEnabled`)} checked={formik.values.embedderEnabled} />
              <span className="p-checkbox__label">Embedder</span>
            </label>
          </fieldset>
          {formik.values.embedderEnabled ? (
            <>
              <label htmlFor="provider-editor-embedding-model">Embedding model</label>
              <input id="provider-editor-embedding-model" type="text" {...formik.getFieldProps(`embeddingModel`)} />
            </>
          ) : null}
        </>
      ) : null}
      <div className="u-align--right">
        {provider && onDelete ? (
          <Button appearance="negative" disabled={formik.isSubmitting || isDeleting} onClick={() => void onDelete(provider)} type="button">
            {isDeleting ? `Deleting provider...` : `Delete provider`}
          </Button>
        ) : null}
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving provider...` : `Save provider`) : formik.isSubmitting ? `Creating provider...` : `Create provider`}
        </Button>
      </div>
    </form>
  );
}
