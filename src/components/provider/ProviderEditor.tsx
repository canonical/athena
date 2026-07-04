import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useFormik } from "formik";
import { createProvider, updateProvider } from "./provider.client.js";
import type { Provider } from "./provider.schema.js";
import { providerInsertSchema, providerLifecycleStatuses, providerTypes, providerUpdateSchema } from "./provider.schema.js";

type ProviderEditorProps = {
  provider?: Provider;
  onSuccess: (title: string, message: string) => void;
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
};

export function ProviderEditor({ provider, onSuccess }: ProviderEditorProps) {
  const isEdit = Boolean(provider);

  const formik = useFormik<ProviderFormValues>({
    enableReinitialize: true,
    initialValues: {
      displayName: provider?.displayName ?? ``,
      providerType: provider?.providerType ?? `openrouter`,
      baseUrl: provider?.baseUrl ?? `https://openrouter.ai/api/v1`,
      apiKey: ``,
      lifecycleStatus: provider?.lifecycleStatus ?? `active`,
    },
    validate: (values) => {
      const payload = {
        displayName: values.displayName,
        providerType: values.providerType,
        baseUrl: values.baseUrl,
        apiKey: isEdit ? values.apiKey || undefined : values.apiKey,
        lifecycleStatus: values.lifecycleStatus,
      };

      const parseResult = (isEdit ? providerUpdateSchema : providerInsertSchema).safeParse(payload);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof ProviderFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && key in values && !errors[key as keyof ProviderFormValues]) {
          errors[key as keyof ProviderFormValues] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      const payload = {
        displayName: values.displayName,
        providerType: values.providerType,
        baseUrl: values.baseUrl,
        apiKey: isEdit ? values.apiKey || undefined : values.apiKey,
        lifecycleStatus: values.lifecycleStatus,
      };

      const parseResult = (isEdit ? providerUpdateSchema : providerInsertSchema).safeParse(payload);

      if (!parseResult.success) {
        helpers.setStatus(parseResult.error.issues[0]?.message ?? `Invalid input.`);
        return;
      }

      try {
        const savedProvider = isEdit ? await updateProvider(provider.id, parseResult.data) : await createProvider(parseResult.data);
        onSuccess(isEdit ? `Provider updated` : `Provider created`, isEdit ? `${savedProvider.displayName} has been updated.` : `${savedProvider.displayName} is available for loop assignment.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        helpers.setStatus(message);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      {typeof formik.status === `string` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title={isEdit ? `Unable to update provider` : `Unable to create provider`}>
          {formik.status}
        </Notification>
      ) : null}
      <label htmlFor="provider-editor-display-name">Display name</label>
      <input id="provider-editor-display-name" name="displayName" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.displayName} />
      {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}
      <label htmlFor="provider-editor-type">Provider type</label>
      <select id="provider-editor-type" name="providerType" onBlur={formik.handleBlur} onChange={formik.handleChange} value={formik.values.providerType}>
        {providerTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <label htmlFor="provider-editor-base-url">Base URL</label>
      <input id="provider-editor-base-url" name="baseUrl" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="url" value={formik.values.baseUrl} />
      {formik.touched.baseUrl && formik.errors.baseUrl ? <p className="p-form-validation is-error">{formik.errors.baseUrl}</p> : null}
      <label htmlFor="provider-editor-api-key">{isEdit ? `API key (optional for rotation)` : `API key`}</label>
      <input id="provider-editor-api-key" name="apiKey" onBlur={formik.handleBlur} onChange={formik.handleChange} required={!isEdit} type="password" value={formik.values.apiKey} />
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
      <label htmlFor="provider-editor-lifecycle-status">Lifecycle status</label>
      <select id="provider-editor-lifecycle-status" name="lifecycleStatus" onBlur={formik.handleBlur} onChange={formik.handleChange} value={formik.values.lifecycleStatus}>
        {providerLifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>
      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving provider...` : `Save provider`) : formik.isSubmitting ? `Creating provider...` : `Create provider`}
        </Button>
      </div>
    </form>
  );
}
