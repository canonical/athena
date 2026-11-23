import { Button } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFormik } from "formik";
import { toFormikValidate } from "zod-formik-adapter";
import type { StepSequence, StepSequenceWritable } from "../stepSequence/stepSequence.schema.js";
import { stepSequenceWritableSchema } from "../stepSequence/stepSequence.schema.js";

export type StepSequenceEditor = { mode: `create` } | { mode: `edit`; sequence: StepSequence };
export type StepSequenceFormValues = StepSequenceWritable;

type LoopStepSequenceEditorProps = {
  editor: StepSequenceEditor | null;
  onClose: () => void;
  onSubmit: (values: StepSequenceFormValues, editor: StepSequenceEditor | null) => Promise<void>;
};

const sequenceInitialValues = (editor: StepSequenceEditor | null): StepSequenceFormValues => ({
  name: editor?.mode === `edit` ? editor.sequence.name : ``,
  isDefault: editor?.mode === `edit` ? editor.sequence.isDefault : false,
});

export function LoopStepSequenceEditor(props: Readonly<LoopStepSequenceEditorProps>) {
  const { editor, onClose, onSubmit } = props;
  const formik = useFormik<StepSequenceFormValues>({
    enableReinitialize: true,
    initialValues: sequenceInitialValues(editor),
    validate: toFormikValidate(stepSequenceWritableSchema),
    onSubmit: (values) => onSubmit(values, editor),
  });
  const isEditing = editor?.mode === `edit`;
  let submitLabel: string;
  if (formik.isSubmitting) {
    submitLabel = `Saving...`;
  } else if (isEditing) {
    submitLabel = `Save sequence`;
  } else {
    submitLabel = `Create sequence`;
  }

  return (
    <EntityDrawer isOpen={editor !== null} onClose={onClose} title={isEditing ? `Edit sequence` : `Create sequence`}>
      <form onSubmit={formik.handleSubmit}>
        <label htmlFor="step-sequence-name">Sequence name</label>
        <input id="step-sequence-name" name="name" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.name} />
        {formik.touched.name && formik.errors.name ? <p className="p-form-validation is-error">{formik.errors.name}</p> : null}
        <label htmlFor="step-sequence-default">
          <input checked={formik.values.isDefault} id="step-sequence-default" name="isDefault" onChange={formik.handleChange} type="checkbox" />
          <span>Default sequence</span>
        </label>
        <div className="u-align--right">
          <Button appearance="base" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </EntityDrawer>
  );
}
