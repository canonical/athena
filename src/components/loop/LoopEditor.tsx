import { Button, NotificationSeverity, useToastNotification } from "@canonical/react-components";
import { useFormik } from "formik";
import { createLoop, updateLoop } from "./loop.client.js";
import type { Feedback, Loop } from "./loop.schema.js";
import { loopInsertSchema, loopUpdateSchema } from "./loop.schema.js";

type LoopEditorProps = {
  loop?: Loop;
  onSuccess: (feedback: Feedback) => void;
};

type LoopFormValues = {
  name: string;
  description: string;
  iterationCostLimitUsd: string;
};

const parseIterationCostLimitUsd = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === `number`) {
    if (!Number.isFinite(value)) {
      throw new Error(`Per-iteration cost limit must be a valid number.`);
    }

    return value;
  }

  if (typeof value !== `string`) {
    throw new Error(`Per-iteration cost limit must be a valid number.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Per-iteration cost limit must be a valid number.`);
  }

  return parsed;
};

const toLoopPayload = (values: LoopFormValues): { name: string; description: string; iterationCostLimitUsd: number | null } => ({
  name: values.name,
  description: values.description,
  iterationCostLimitUsd: parseIterationCostLimitUsd(values.iterationCostLimitUsd),
});

export function LoopEditor({ loop, onSuccess }: LoopEditorProps) {
  const isEdit = Boolean(loop);
  const toastNotify = useToastNotification();

  const formik = useFormik<LoopFormValues>({
    enableReinitialize: true,
    initialValues: {
      name: loop?.name ?? ``,
      description: loop?.description ?? ``,
      iterationCostLimitUsd: loop?.iterationCostLimitUsd === null || loop?.iterationCostLimitUsd === undefined ? `` : String(loop.iterationCostLimitUsd),
    },
    validate: (values) => {
      let payload: { name: string; description: string; iterationCostLimitUsd: number | null };

      try {
        payload = toLoopPayload(values);
      } catch (error) {
        return {
          iterationCostLimitUsd: error instanceof Error ? error.message : String(error),
        };
      }

      const parseResult = (isEdit ? loopUpdateSchema : loopInsertSchema).safeParse(payload);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof LoopFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && (key === `name` || key === `description` || key === `iterationCostLimitUsd`) && !errors[key]) {
          errors[key] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      let payload: { name: string; description: string; iterationCostLimitUsd: number | null };

      try {
        payload = toLoopPayload(values);
      } catch (error) {
        toastNotify.failure(isEdit ? `Unable to update loop` : `Unable to create loop`, error instanceof Error ? error : new Error(String(error)));
        return;
      }

      const parseResult = (isEdit ? loopUpdateSchema : loopInsertSchema).safeParse(payload);

      if (!parseResult.success) {
        toastNotify.failure(isEdit ? `Unable to update loop` : `Unable to create loop`, new Error(parseResult.error.issues[0]?.message ?? `Invalid input.`));
        return;
      }

      try {
        const savedLoop = loop ? await updateLoop(loop.id, loopUpdateSchema.parse(payload)) : await createLoop(loopInsertSchema.parse(payload));

        onSuccess({
          severity: NotificationSeverity.INFORMATION,
          title: isEdit ? `Loop updated` : `Loop created`,
          message: isEdit ? `${savedLoop.name} has been updated.` : `${savedLoop.name} is ready to receive tasks.`,
        });
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        toastNotify.failure(isEdit ? `Unable to update loop` : `Unable to create loop`, submitError instanceof Error ? submitError : new Error(message));
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="loop-editor-name">Loop name</label>
      <input id="loop-editor-name" name="name" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.name} />
      {formik.touched.name && formik.errors.name ? <p className="p-form-validation is-error">{formik.errors.name}</p> : null}
      <label htmlFor="loop-editor-description">Loop description</label>
      <textarea id="loop-editor-description" name="description" onBlur={formik.handleBlur} onChange={formik.handleChange} rows={3} value={formik.values.description} />
      {formik.touched.description && formik.errors.description ? <p className="p-form-validation is-error">{formik.errors.description}</p> : null}
      <label htmlFor="loop-editor-iteration-cost-limit-usd">Per-iteration cost limit (USD)</label>
      <input
        id="loop-editor-iteration-cost-limit-usd"
        min="0"
        name="iterationCostLimitUsd"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        placeholder="Leave empty for no limit"
        step="0.000001"
        type="number"
        value={formik.values.iterationCostLimitUsd}
      />
      {formik.touched.iterationCostLimitUsd && formik.errors.iterationCostLimitUsd ? <p className="p-form-validation is-error">{formik.errors.iterationCostLimitUsd}</p> : null}
      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving loop...` : `Save loop`) : formik.isSubmitting ? `Creating loop...` : `Create loop`}
        </Button>
      </div>
    </form>
  );
}
