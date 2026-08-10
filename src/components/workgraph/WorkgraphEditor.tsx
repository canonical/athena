import { Button, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import { useState } from "react";
import type { z } from "zod";
import { createWorkgraph, testWorkgraphConnection, updateWorkgraph } from "./workgraph.client.js";
import type { Workgraph, WorkgraphTypeOption } from "./workgraph.schema.js";
import { workgraphConnectionTestSchema, workgraphInsertSchema, workgraphLifecycleStatuses, workgraphUpdateSchema } from "./workgraph.schema.js";

type WorkgraphEditorProps = {
  workgraph?: Workgraph;
  typeOptions: WorkgraphTypeOption[];
  onSuccess: (title: string, message: string) => void;
  onDelete?: (workgraph: Workgraph) => Promise<void>;
  isDeleting?: boolean;
};

const lifecycleLabel: Record<(typeof workgraphLifecycleStatuses)[number], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type WorkgraphFormValues = {
  name: string;
  type: WorkgraphTypeOption[`id`];
  baseUrl: string;
  browseBaseUrl: string;
  projectKey: string;
  email: string;
  apiKey: string;
  lifecycleStatus: (typeof workgraphLifecycleStatuses)[number];
};

const toFormikErrors = (error: z.ZodError, values: WorkgraphFormValues): Partial<Record<keyof WorkgraphFormValues, string>> => {
  const errors: Partial<Record<keyof WorkgraphFormValues, string>> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (typeof key === `string` && key in values && !errors[key as keyof WorkgraphFormValues]) {
      errors[key as keyof WorkgraphFormValues] = issue.message;
    }
  }

  return errors;
};

export function WorkgraphEditor({ workgraph, typeOptions, onSuccess, onDelete, isDeleting = false }: WorkgraphEditorProps) {
  const isEdit = Boolean(workgraph);
  const toastNotify = useToastNotification();
  const [isTesting, setIsTesting] = useState(false);

  const parseWorkgraphFormValues = (values: WorkgraphFormValues) => {
    const payload = {
      name: values.name,
      type: values.type,
      baseUrl: values.baseUrl,
      browseBaseUrl: values.browseBaseUrl,
      projectKey: values.projectKey,
      email: values.email,
      apiKey: isEdit ? values.apiKey || undefined : values.apiKey,
      lifecycleStatus: values.lifecycleStatus,
    };

    const schema = isEdit ? workgraphUpdateSchema : workgraphInsertSchema;
    return schema.safeParse(payload);
  };

  const parseWorkgraphInsertFormValues = (values: WorkgraphFormValues) =>
    workgraphInsertSchema.safeParse({
      name: values.name,
      type: values.type,
      baseUrl: values.baseUrl,
      browseBaseUrl: values.browseBaseUrl,
      projectKey: values.projectKey,
      email: values.email,
      apiKey: values.apiKey,
      lifecycleStatus: values.lifecycleStatus,
    });

  const parseWorkgraphUpdateFormValues = (values: WorkgraphFormValues) =>
    workgraphUpdateSchema.safeParse({
      name: values.name,
      type: values.type,
      baseUrl: values.baseUrl,
      browseBaseUrl: values.browseBaseUrl,
      projectKey: values.projectKey,
      email: values.email,
      apiKey: values.apiKey || undefined,
      lifecycleStatus: values.lifecycleStatus,
    });

  const formik = useFormik<WorkgraphFormValues>({
    enableReinitialize: true,
    initialValues: {
      name: workgraph?.name ?? ``,
      type: workgraph?.type ?? `jira`,
      baseUrl: workgraph?.baseUrl ?? `https://your-domain.atlassian.net`,
      browseBaseUrl: workgraph?.browseBaseUrl ?? workgraph?.baseUrl ?? `https://your-domain.atlassian.net`,
      projectKey: workgraph?.projectKey ?? ``,
      email: workgraph?.email ?? ``,
      apiKey: ``,
      lifecycleStatus: workgraph?.lifecycleStatus ?? `active`,
    },
    validate: (values) => {
      const parseResult = parseWorkgraphFormValues(values);

      if (parseResult.success) {
        return {};
      }

      return toFormikErrors(parseResult.error, values);
    },
    onSubmit: async (values) => {
      try {
        if (workgraph) {
          const parseResult = parseWorkgraphUpdateFormValues(values);

          if (!parseResult.success) {
            toastNotify.failure(`Unable to update workgraph`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
            return;
          }

          const savedWorkgraph = await updateWorkgraph(workgraph.id, parseResult.data);
          onSuccess(`Workgraph updated`, `${savedWorkgraph.name} has been updated.`);
          return;
        }

        const parseResult = parseWorkgraphInsertFormValues(values);

        if (!parseResult.success) {
          toastNotify.failure(`Unable to create workgraph`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
          return;
        }

        const savedWorkgraph = await createWorkgraph(parseResult.data);
        onSuccess(`Workgraph created`, `${savedWorkgraph.name} is available for loop assignment.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update workgraph` : `Unable to create workgraph`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  const handleTestConnection = async () => {
    const parseResult = workgraphConnectionTestSchema.safeParse({
      type: formik.values.type,
      baseUrl: formik.values.baseUrl,
      projectKey: formik.values.projectKey,
      email: formik.values.email,
      apiKey: formik.values.apiKey,
    });

    if (!parseResult.success) {
      toastNotify.failure(`Unable to test workgraph connection`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
      return;
    }

    setIsTesting(true);

    try {
      const result = await testWorkgraphConnection(parseResult.data);
      toastNotify.info(result.message, `Connection test passed`);
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : String(testError);
      toastNotify.failure(`Workgraph connection test failed`, testError instanceof Error ? testError : new Error(message));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="workgraph-editor-name">Name</label>
      <input id="workgraph-editor-name" required type="text" {...formik.getFieldProps(`name`)} />
      {formik.touched.name && formik.errors.name ? <p className="p-form-validation is-error">{formik.errors.name}</p> : null}
      <label htmlFor="workgraph-editor-type">Workgraph type</label>
      <select id="workgraph-editor-type" {...formik.getFieldProps(`type`)}>
        {typeOptions.map((typeOption) => (
          <option key={typeOption.id} value={typeOption.id}>
            {typeOption.label}
          </option>
        ))}
      </select>
      <label htmlFor="workgraph-editor-base-url">Base URL</label>
      <input id="workgraph-editor-base-url" required type="url" {...formik.getFieldProps(`baseUrl`)} />
      {formik.touched.baseUrl && formik.errors.baseUrl ? <p className="p-form-validation is-error">{formik.errors.baseUrl}</p> : null}
      <label htmlFor="workgraph-editor-browse-base-url">Browse base URL</label>
      <input id="workgraph-editor-browse-base-url" required type="url" {...formik.getFieldProps(`browseBaseUrl`)} />
      <p className="p-text--small">Used to open ticket links in Jira UI, for example https://your-domain.atlassian.net.</p>
      {formik.touched.browseBaseUrl && formik.errors.browseBaseUrl ? <p className="p-form-validation is-error">{formik.errors.browseBaseUrl}</p> : null}
      <label htmlFor="workgraph-editor-project-key">Project key (optional)</label>
      <input id="workgraph-editor-project-key" type="text" {...formik.getFieldProps(`projectKey`)} />
      <label htmlFor="workgraph-editor-email">Jira email</label>
      <input id="workgraph-editor-email" required type="email" {...formik.getFieldProps(`email`)} />
      {formik.touched.email && formik.errors.email ? <p className="p-form-validation is-error">{formik.errors.email}</p> : null}
      <label htmlFor="workgraph-editor-api-key">{isEdit ? `Jira PAT — Personal Access Token (leave blank to keep existing)` : `Jira PAT — Personal Access Token`}</label>
      <input id="workgraph-editor-api-key" required={!isEdit} type="password" {...formik.getFieldProps(`apiKey`)} />
      <p className="p-text--small">Generate a PAT at your Jira profile &rarr; Security &rarr; Personal Access Tokens.</p>
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
      <label htmlFor="workgraph-editor-lifecycle-status">Lifecycle status</label>
      <select id="workgraph-editor-lifecycle-status" {...formik.getFieldProps(`lifecycleStatus`)}>
        {workgraphLifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>
      <div className="u-align--right">
        {workgraph && onDelete ? (
          <Button appearance="negative" disabled={formik.isSubmitting || isDeleting} onClick={() => void onDelete(workgraph)} type="button">
            {isDeleting ? `Deleting workgraph...` : `Delete workgraph`}
          </Button>
        ) : null}
        {!isEdit ? (
          <Button appearance="base" disabled={formik.isSubmitting || isTesting} onClick={() => void handleTestConnection()} type="button">
            {isTesting ? `Testing...` : `Test`}
          </Button>
        ) : null}
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving workgraph...` : `Save workgraph`) : formik.isSubmitting ? `Creating...` : `Create`}
        </Button>
      </div>
    </form>
  );
}
