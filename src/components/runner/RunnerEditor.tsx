import { Button, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import { toFormikValidate } from "zod-formik-adapter";
import { createRunner, updateRunner } from "./runner.client.js";
import type { Runner } from "./runner.schema.js";
import { lifecycleStatuses, runnerInsertSchema, type runnerTypes, runnerUpdateSchema } from "./runner.schema.js";

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
  name: string;
  type: (typeof runnerTypes)[number];
  apiKey: string;
  lifecycleStatus: (typeof lifecycleStatuses)[number];
};

export function RunnerEditor({ runner, onSuccess }: RunnerEditorProps) {
  const isEdit = Boolean(runner);
  const toastNotify = useToastNotification();

  const formik = useFormik<RunnerFormValues>({
    enableReinitialize: true,
    initialValues: {
      name: runner?.name ?? ``,
      type: runner?.type ?? `athena-workshop`,
      apiKey: ``,
      lifecycleStatus: runner?.lifecycleStatus ?? `active`,
    },
    validate: toFormikValidate(isEdit ? runnerUpdateSchema : runnerInsertSchema),
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      try {
        if (runner) {
          const parseResult = runnerUpdateSchema.safeParse({
            name: values.name,
            apiKey: values.apiKey || undefined,
            lifecycleStatus: values.lifecycleStatus,
          });

          if (!parseResult.success) {
            toastNotify.failure(`Unable to update runner`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
            return;
          }

          const savedRunner = await updateRunner(runner.id, parseResult.data);
          onSuccess(`Runner updated`, `${savedRunner.name} has been updated.`);
          return;
        }

        const parseResult = runnerInsertSchema.safeParse({
          name: values.name,
          type: values.type,
          apiKey: values.apiKey,
          lifecycleStatus: values.lifecycleStatus,
        });

        if (!parseResult.success) {
          toastNotify.failure(`Unable to create runner`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
          return;
        }

        const savedRunner = await createRunner(parseResult.data);
        onSuccess(`Runner created`, `${savedRunner.name} is available for loop assignment.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update runner` : `Unable to create runner`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="runner-editor-name">Display name</label>
      <input id="runner-editor-name" name="name" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.name} />
      {formik.touched.name && formik.errors.name ? <p className="p-form-validation is-error">{formik.errors.name}</p> : null}
      <label htmlFor="runner-editor-runner-type">Runner</label>
      <select disabled={isEdit} id="runner-editor-runner-type" name="type" onBlur={formik.handleBlur} onChange={formik.handleChange} value={formik.values.type}>
        <option value="github-copilot-cloud">GitHub Copilot Cloud</option>
        <option value="athena-workshop">Athena Workshop</option>
      </select>
      {formik.values.type === `github-copilot-cloud` ? (
        <>
          <label htmlFor="runner-editor-api-key">{isEdit ? `API key (optional for rotation)` : `API key`}</label>
          <input id="runner-editor-api-key" name="apiKey" onBlur={formik.handleBlur} onChange={formik.handleChange} required={!isEdit} type="password" value={formik.values.apiKey} />
          {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
        </>
      ) : (
        <p className="p-text--small">Workshop runners connect using a shared workforce token.</p>
      )}
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
