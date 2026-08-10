import { Button, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import type { z } from "zod";
import { createRepository, testRepositoryConnection, updateRepository } from "./repository.client.js";
import type { Repository } from "./repository.schema.js";
import { repositoryInsertSchema, repositoryLifecycleStatuses, repositoryTypes, repositoryUpdateSchema } from "./repository.schema.js";

type RepositoryEditorProps = {
  repository?: Repository;
  onSuccess: (title: string, message: string) => void;
  onDelete?: (repository: Repository) => Promise<void>;
  isDeleting?: boolean;
};

type RepositoryFormValues = {
  displayName: string;
  repositoryType: (typeof repositoryTypes)[number];
  apiBaseUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  defaultBranch: string;
  apiKey: string;
  lifecycleStatus: (typeof repositoryLifecycleStatuses)[number];
};

const lifecycleLabel: Record<(typeof repositoryLifecycleStatuses)[number], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

const toFormikErrors = (error: z.ZodError, values: RepositoryFormValues): Partial<Record<keyof RepositoryFormValues, string>> => {
  const errors: Partial<Record<keyof RepositoryFormValues, string>> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (typeof key === `string` && key in values && !errors[key as keyof RepositoryFormValues]) {
      errors[key as keyof RepositoryFormValues] = issue.message;
    }
  }

  return errors;
};

export function RepositoryEditor({ repository, onSuccess, onDelete, isDeleting = false }: RepositoryEditorProps) {
  const isEdit = Boolean(repository);
  const toastNotify = useToastNotification();

  const parseInsertFormValues = (values: RepositoryFormValues) =>
    repositoryInsertSchema.safeParse({
      displayName: values.displayName,
      repositoryType: values.repositoryType,
      apiBaseUrl: values.apiBaseUrl,
      repositoryOwner: values.repositoryOwner,
      repositoryName: values.repositoryName,
      defaultBranch: values.defaultBranch || undefined,
      apiKey: values.apiKey,
      lifecycleStatus: values.lifecycleStatus,
    });

  const parseUpdateFormValues = (values: RepositoryFormValues) =>
    repositoryUpdateSchema.safeParse({
      displayName: values.displayName,
      repositoryType: values.repositoryType,
      apiBaseUrl: values.apiBaseUrl,
      repositoryOwner: values.repositoryOwner,
      repositoryName: values.repositoryName,
      defaultBranch: values.defaultBranch || undefined,
      apiKey: values.apiKey || undefined,
      lifecycleStatus: values.lifecycleStatus,
    });

  const parseFormValues = (values: RepositoryFormValues) => {
    return isEdit ? parseUpdateFormValues(values) : parseInsertFormValues(values);
  };

  const formik = useFormik<RepositoryFormValues>({
    enableReinitialize: true,
    initialValues: {
      displayName: repository?.displayName ?? ``,
      repositoryType: repository?.repositoryType ?? `github`,
      apiBaseUrl: repository?.apiBaseUrl ?? `https://api.github.com`,
      repositoryOwner: repository?.repositoryOwner ?? ``,
      repositoryName: repository?.repositoryName ?? ``,
      defaultBranch: repository?.defaultBranch ?? `main`,
      apiKey: ``,
      lifecycleStatus: repository?.lifecycleStatus ?? `active`,
    },
    validate: (values) => {
      const parseResult = parseFormValues(values);

      if (parseResult.success) {
        return {};
      }

      return toFormikErrors(parseResult.error, values);
    },
    onSubmit: async (values) => {
      try {
        if (repository) {
          const parseResult = parseUpdateFormValues(values);

          if (!parseResult.success) {
            toastNotify.failure(`Unable to update repository`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
            return;
          }

          const saved = await updateRepository(repository.id, parseResult.data);
          onSuccess(`Repository updated`, `${saved.displayName} has been updated.`);
          return;
        }

        const parseResult = parseInsertFormValues(values);

        if (!parseResult.success) {
          toastNotify.failure(`Unable to create repository`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
          return;
        }

        const saved = await createRepository(parseResult.data);
        onSuccess(`Repository created`, `${saved.displayName} is available in connections.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update repository` : `Unable to create repository`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  const handleTestConnection = async () => {
    const parseResult = parseFormValues(formik.values);

    if (!parseResult.success) {
      toastNotify.failure(`Unable to test repository connection`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
      return;
    }

    if (!parseResult.data.apiKey) {
      toastNotify.failure(`Unable to test repository connection`, new Error(`API key is required for connection testing.`));
      return;
    }

    try {
      const result = await testRepositoryConnection({
        repositoryType: parseResult.data.repositoryType,
        apiBaseUrl: parseResult.data.apiBaseUrl,
        repositoryOwner: parseResult.data.repositoryOwner,
        repositoryName: parseResult.data.repositoryName,
        apiKey: parseResult.data.apiKey,
      });
      toastNotify.info(result.message, `Connection test passed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastNotify.failure(`Unable to test repository connection`, error instanceof Error ? error : new Error(message));
    }
  };

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="repository-editor-display-name">Display name</label>
      <input id="repository-editor-display-name" required type="text" {...formik.getFieldProps(`displayName`)} />
      {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}

      <label htmlFor="repository-editor-type">Repository type</label>
      <select id="repository-editor-type" {...formik.getFieldProps(`repositoryType`)}>
        {repositoryTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <label htmlFor="repository-editor-api-base-url">API base URL</label>
      <input id="repository-editor-api-base-url" required type="url" {...formik.getFieldProps(`apiBaseUrl`)} />
      {formik.touched.apiBaseUrl && formik.errors.apiBaseUrl ? <p className="p-form-validation is-error">{formik.errors.apiBaseUrl}</p> : null}

      <label htmlFor="repository-editor-owner">Repository owner</label>
      <input id="repository-editor-owner" required type="text" {...formik.getFieldProps(`repositoryOwner`)} />
      {formik.touched.repositoryOwner && formik.errors.repositoryOwner ? <p className="p-form-validation is-error">{formik.errors.repositoryOwner}</p> : null}

      <label htmlFor="repository-editor-name">Repository name</label>
      <input id="repository-editor-name" required type="text" {...formik.getFieldProps(`repositoryName`)} />
      {formik.touched.repositoryName && formik.errors.repositoryName ? <p className="p-form-validation is-error">{formik.errors.repositoryName}</p> : null}

      <label htmlFor="repository-editor-default-branch">Default branch</label>
      <input id="repository-editor-default-branch" type="text" {...formik.getFieldProps(`defaultBranch`)} />

      <label htmlFor="repository-editor-api-key">{isEdit ? `GitHub token (optional for rotation)` : `GitHub token`}</label>
      <input id="repository-editor-api-key" required={!isEdit} type="password" {...formik.getFieldProps(`apiKey`)} />
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}

      <label htmlFor="repository-editor-lifecycle-status">Lifecycle status</label>
      <select id="repository-editor-lifecycle-status" {...formik.getFieldProps(`lifecycleStatus`)}>
        {repositoryLifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>

      <div className="u-align--right">
        {repository && onDelete ? (
          <Button appearance="negative" disabled={formik.isSubmitting || isDeleting} onClick={() => void onDelete(repository)} type="button">
            {isDeleting ? `Deleting repository...` : `Delete repository`}
          </Button>
        ) : null}
        <Button appearance="base" disabled={formik.isSubmitting} onClick={handleTestConnection} type="button">
          Test connection
        </Button>
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving repository...` : `Save repository`) : formik.isSubmitting ? `Creating repository...` : `Create repository`}
        </Button>
      </div>
    </form>
  );
}
