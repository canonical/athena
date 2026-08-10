import { Button, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import { createRunner, updateRunner } from "./runner.client.js";
import type { Runner } from "./runner.schema.js";
import { lifecycleStatuses, runnerInsertSchema, runnerUpdateSchema } from "./runner.schema.js";

type RunnerEditorProps = {
  runner?: Runner;
  onSuccess: (title: string, message: string) => void;
};

const lifecycleLabel: Record<(typeof lifecycleStatuses)[number], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type RunnerFormValues = {
  displayName: string;
  runnerType: `github-copilot-cloud`;
  apiKey: string;
  lifecycleStatus: (typeof lifecycleStatuses)[number];
};

export function RunnerEditor({ runner, onSuccess }: RunnerEditorProps) {
  const isEdit = Boolean(runner);
  const toastNotify = useToastNotification();

  const formik = useFormik<RunnerFormValues>({
    enableReinitialize: true,
    initialValues: {
      displayName: runner?.displayName ?? ``,
      runnerType: `github-copilot-cloud`,
      apiKey: ``,
      lifecycleStatus: runner?.lifecycleStatus ?? `active`,
    },
    validate: (values) => {
      const payload = {
        displayName: values.displayName,
        apiKey: isEdit ? values.apiKey || undefined : values.apiKey,
        lifecycleStatus: values.lifecycleStatus,
        ...(isEdit ? {} : { runnerType: values.runnerType }),
      };

      const parseResult = (isEdit ? runnerUpdateSchema : runnerInsertSchema).safeParse(payload);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof RunnerFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && key in values && !errors[key as keyof RunnerFormValues]) {
          errors[key as keyof RunnerFormValues] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      try {
        if (runner) {
          const parseResult = runnerUpdateSchema.safeParse({
            displayName: values.displayName,
            apiKey: values.apiKey || undefined,
            lifecycleStatus: values.lifecycleStatus,
          });

          if (!parseResult.success) {
            toastNotify.failure(`Unable to update runner`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
            return;
          }

          const savedRunner = await updateRunner(runner.id, parseResult.data);
          onSuccess(`Runner updated`, `${savedRunner.displayName} has been updated.`);
          return;
        }

        const parseResult = runnerInsertSchema.safeParse({
          displayName: values.displayName,
          runnerType: values.runnerType,
          apiKey: values.apiKey,
          lifecycleStatus: values.lifecycleStatus,
        });

        if (!parseResult.success) {
          toastNotify.failure(`Unable to create runner`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
          return;
        }

        const savedRunner = await createRunner(parseResult.data);
        onSuccess(`Runner created`, `${savedRunner.displayName} is available for loop assignment.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update runner` : `Unable to create runner`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="runner-editor-display-name">Display name</label>
      <input id="runner-editor-display-name" name="displayName" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.displayName} />
      {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}
      <label htmlFor="runner-editor-runner-type">Runner</label>
      <select disabled id="runner-editor-runner-type" name="runnerType" value={formik.values.runnerType}>
        <option value="github-copilot-cloud">GitHub Copilot Cloud</option>
      </select>
      <p className="p-text--small">GitHub Copilot is currently the only bundled runner supported in MVP.</p>
      <label htmlFor="runner-editor-api-key">{isEdit ? `API key (optional for rotation)` : `API key`}</label>
      <input id="runner-editor-api-key" name="apiKey" onBlur={formik.handleBlur} onChange={formik.handleChange} required={!isEdit} type="password" value={formik.values.apiKey} />
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
      <label htmlFor="runner-editor-lifecycle-status">Lifecycle status</label>
      <select id="runner-editor-lifecycle-status" name="lifecycleStatus" onBlur={formik.handleBlur} onChange={formik.handleChange} value={formik.values.lifecycleStatus}>
        {lifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>
      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving runner...` : `Save runner`) : formik.isSubmitting ? `Creating runner...` : `Create runner`}
        </Button>
      </div>
    </form>
  );
}
