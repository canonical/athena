import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useFormik } from "formik";
import { createHarness, updateHarness } from "./harness.client.js";
import type { Harness } from "./harness.schema.js";
import { harnessInsertSchema, harnessUpdateSchema, lifecycleStatuses } from "./harness.schema.js";

type HarnessEditorProps = {
  harness?: Harness;
  onSuccess: (title: string, message: string) => void;
};

const lifecycleLabel: Record<(typeof lifecycleStatuses)[number], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type HarnessFormValues = {
  displayName: string;
  runnerType: `github-copilot-cloud`;
  apiKey: string;
  lifecycleStatus: (typeof lifecycleStatuses)[number];
};

export function HarnessEditor({ harness, onSuccess }: HarnessEditorProps) {
  const isEdit = Boolean(harness);

  const formik = useFormik<HarnessFormValues>({
    enableReinitialize: true,
    initialValues: {
      displayName: harness?.displayName ?? ``,
      runnerType: `github-copilot-cloud`,
      apiKey: ``,
      lifecycleStatus: harness?.lifecycleStatus ?? `active`,
    },
    validate: (values) => {
      const payload = {
        displayName: values.displayName,
        apiKey: isEdit ? values.apiKey || undefined : values.apiKey,
        lifecycleStatus: values.lifecycleStatus,
        ...(isEdit ? {} : { runnerType: values.runnerType }),
      };

      const parseResult = (isEdit ? harnessUpdateSchema : harnessInsertSchema).safeParse(payload);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof HarnessFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && key in values && !errors[key as keyof HarnessFormValues]) {
          errors[key as keyof HarnessFormValues] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      try {
        if (harness) {
          const parseResult = harnessUpdateSchema.safeParse({
            displayName: values.displayName,
            apiKey: values.apiKey || undefined,
            lifecycleStatus: values.lifecycleStatus,
          });

          if (!parseResult.success) {
            helpers.setStatus(parseResult.error.issues[0]?.message ?? `Invalid input.`);
            return;
          }

          const savedHarness = await updateHarness(harness.id, parseResult.data);
          onSuccess(`Harness updated`, `${savedHarness.displayName} has been updated.`);
          return;
        }

        const parseResult = harnessInsertSchema.safeParse({
          displayName: values.displayName,
          runnerType: values.runnerType,
          apiKey: values.apiKey,
          lifecycleStatus: values.lifecycleStatus,
        });

        if (!parseResult.success) {
          helpers.setStatus(parseResult.error.issues[0]?.message ?? `Invalid input.`);
          return;
        }

        const savedHarness = await createHarness(parseResult.data);
        onSuccess(`Harness created`, `${savedHarness.displayName} is available for loop assignment.`);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        helpers.setStatus(message);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      {typeof formik.status === `string` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title={isEdit ? `Unable to update harness` : `Unable to create harness`}>
          {formik.status}
        </Notification>
      ) : null}
      <label htmlFor="harness-editor-display-name">Display name</label>
      <input id="harness-editor-display-name" name="displayName" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.displayName} />
      {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}
      <label htmlFor="harness-editor-runner-type">Runner</label>
      <select disabled id="harness-editor-runner-type" name="runnerType" value={formik.values.runnerType}>
        <option value="github-copilot-cloud">GitHub Copilot Cloud</option>
      </select>
      <p className="p-text--small">GitHub Copilot is currently the only bundled runner and harness supported in MVP.</p>
      <label htmlFor="harness-editor-api-key">{isEdit ? `API key (optional for rotation)` : `API key`}</label>
      <input id="harness-editor-api-key" name="apiKey" onBlur={formik.handleBlur} onChange={formik.handleChange} required={!isEdit} type="password" value={formik.values.apiKey} />
      {formik.touched.apiKey && formik.errors.apiKey ? <p className="p-form-validation is-error">{formik.errors.apiKey}</p> : null}
      <label htmlFor="harness-editor-lifecycle-status">Lifecycle status</label>
      <select id="harness-editor-lifecycle-status" name="lifecycleStatus" onBlur={formik.handleBlur} onChange={formik.handleChange} value={formik.values.lifecycleStatus}>
        {lifecycleStatuses.map((status) => (
          <option key={status} value={status}>
            {lifecycleLabel[status]}
          </option>
        ))}
      </select>
      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving harness...` : `Save harness`) : formik.isSubmitting ? `Creating harness...` : `Create harness`}
        </Button>
      </div>
    </form>
  );
}
