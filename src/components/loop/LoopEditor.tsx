import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
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
};

export function LoopEditor({ loop, onSuccess }: LoopEditorProps) {
  const isEdit = Boolean(loop);

  const formik = useFormik<LoopFormValues>({
    enableReinitialize: true,
    initialValues: {
      name: loop?.name ?? ``,
      description: loop?.description ?? ``,
    },
    validate: (values) => {
      const parseResult = (isEdit ? loopUpdateSchema : loopInsertSchema).safeParse(values);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof LoopFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && (key === `name` || key === `description`) && !errors[key]) {
          errors[key] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      const parseResult = (isEdit ? loopUpdateSchema : loopInsertSchema).safeParse(values);

      if (!parseResult.success) {
        helpers.setStatus(parseResult.error.issues[0]?.message ?? `Invalid input.`);
        return;
      }

      try {
        const savedLoop = loop ? await updateLoop(loop.id, parseResult.data) : await createLoop(parseResult.data);

        onSuccess({
          severity: NotificationSeverity.INFORMATION,
          title: isEdit ? `Loop updated` : `Loop created`,
          message: isEdit ? `${savedLoop.name} has been updated.` : `${savedLoop.name} is ready to receive events.`,
        });
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError);
        helpers.setStatus(message);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      {typeof formik.status === `string` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title={isEdit ? `Unable to update loop` : `Unable to create loop`}>
          {formik.status}
        </Notification>
      ) : null}
      <label htmlFor="loop-editor-name">Loop name</label>
      <input id="loop-editor-name" name="name" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.name} />
      {formik.touched.name && formik.errors.name ? <p className="p-form-validation is-error">{formik.errors.name}</p> : null}
      <label htmlFor="loop-editor-description">Loop description</label>
      <textarea id="loop-editor-description" name="description" onBlur={formik.handleBlur} onChange={formik.handleChange} rows={3} value={formik.values.description} />
      {formik.touched.description && formik.errors.description ? <p className="p-form-validation is-error">{formik.errors.description}</p> : null}
      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {isEdit ? (formik.isSubmitting ? `Saving loop...` : `Save loop`) : formik.isSubmitting ? `Creating loop...` : `Create loop`}
        </Button>
      </div>
    </form>
  );
}
