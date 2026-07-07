import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import type { User } from "@components/authentication/session.schema.js";
import { useFormik } from "formik";
import { assignPersonaToLoop, createPersona, updatePersona } from "./persona.client.js";
import type { PersonaEditorProps, Persona as PersonaRecord } from "./persona.schema.js";
import { personaInsertSchema, personaLifecycleStatuses, personaUpdateSchema } from "./persona.schema.js";

export const isPersonaOwner = (persona: PersonaRecord, currentUser: User | null): boolean => {
  if (!currentUser || !persona.owner) {
    return false;
  }

  return persona.owner === currentUser.id;
};

export const personaEditorKey = (editingPersona: PersonaRecord | null, cloneSource: PersonaRecord | null): string => editingPersona?.id ?? (cloneSource ? `clone-${cloneSource.id}` : `new`);

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type PersonaFormValues = {
  displayName: string;
  role: string;
  personality: string;
  lifecycleStatus: (typeof personaLifecycleStatuses)[number];
};

export function PersonaEditor({ loopId, editingPersona, cloneSource, catalogTemplates, onSuccess, onCancel }: PersonaEditorProps) {
  const isEdit = Boolean(editingPersona);

  const formik = useFormik<PersonaFormValues>({
    enableReinitialize: true,
    initialValues: editingPersona
      ? {
          displayName: editingPersona.displayName,
          role: editingPersona.role ?? ``,
          personality: editingPersona.personality,
          lifecycleStatus: editingPersona.lifecycleStatus,
        }
      : cloneSource
        ? {
            displayName: cloneSource.displayName,
            role: cloneSource.role ?? ``,
            personality: cloneSource.personality,
            lifecycleStatus: cloneSource.lifecycleStatus,
          }
        : {
            displayName: ``,
            role: ``,
            personality: ``,
            lifecycleStatus: `active`,
          },
    validate: (values) => {
      const parseResult = (isEdit ? personaUpdateSchema : personaInsertSchema).safeParse(values);

      if (parseResult.success) {
        return {};
      }

      const errors: Partial<Record<keyof PersonaFormValues, string>> = {};

      for (const issue of parseResult.error.issues) {
        const key = issue.path[0];

        if (typeof key === `string` && key in values && !errors[key as keyof PersonaFormValues]) {
          errors[key as keyof PersonaFormValues] = issue.message;
        }
      }

      return errors;
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);

      const parseResult = (isEdit ? personaUpdateSchema : personaInsertSchema).safeParse(values);

      if (!parseResult.success) {
        helpers.setStatus(parseResult.error.issues[0]?.message ?? `Invalid input.`);
        return;
      }

      try {
        if (editingPersona) {
          await updatePersona(editingPersona.id, parseResult.data);
          onSuccess(`${values.displayName} has been updated.`);
        } else {
          const created = await createPersona(parseResult.data);
          if (loopId) {
            await assignPersonaToLoop(loopId, created.id);
            onSuccess(`${values.displayName} has been added to the loop.`);
          } else {
            onSuccess(`${values.displayName} has been created.`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        helpers.setStatus(message);
      }
    },
  });

  const applyTemplate = (ref: PersonaRecord) => {
    formik.setValues({
      displayName: ref.displayName,
      role: ref.role ?? ``,
      personality: ref.personality,
      lifecycleStatus: `active`,
    });
    formik.setStatus(undefined);
  };

  return (
    <div>
      {catalogTemplates && catalogTemplates.length > 0 ? (
        <div className="p-card p-strip is-shallow">
          <h2 className="p-heading--4">Reference persona templates</h2>
          <p className="p-text--default">Select a reference persona to pre-fill the form below with a standard personality definition.</p>
          <div>
            {catalogTemplates.map((ref) => (
              <Button appearance="base" key={ref.id} onClick={() => applyTemplate(ref)} type="button">
                {ref.displayName}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="p-card p-strip is-shallow">
        {typeof formik.status === `string` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title={editingPersona ? `Unable to update persona` : `Unable to create persona`}>
            {formik.status}
          </Notification>
        ) : null}
        <form onSubmit={formik.handleSubmit}>
          <h2 className="p-heading--4">{editingPersona ? `Edit persona` : cloneSource ? `Clone persona` : `Add persona`}</h2>
          <label htmlFor="persona-display-name">Display name</label>
          <input id="persona-display-name" name="displayName" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.displayName} />
          {formik.touched.displayName && formik.errors.displayName ? <p className="p-form-validation is-error">{formik.errors.displayName}</p> : null}
          <label htmlFor="persona-role">Role</label>
          <input id="persona-role" name="role" onBlur={formik.handleBlur} onChange={formik.handleChange} type="text" value={formik.values.role} />
          {formik.touched.role && formik.errors.role ? <p className="p-form-validation is-error">{formik.errors.role}</p> : null}
          <label htmlFor="persona-personality">Personality</label>
          <textarea id="persona-personality" name="personality" onBlur={formik.handleBlur} onChange={formik.handleChange} required rows={6} value={formik.values.personality} />
          {formik.touched.personality && formik.errors.personality ? <p className="p-form-validation is-error">{formik.errors.personality}</p> : null}
          <Select
            id="persona-lifecycle-status"
            label="Lifecycle status"
            name="lifecycleStatus"
            onChange={formik.handleChange}
            options={personaLifecycleStatuses.map((status) => ({ value: status, label: lifecycleStatusLabel[status] ?? status }))}
            value={formik.values.lifecycleStatus}
          />
          <div className="u-align--right">
            {(editingPersona || cloneSource) && onCancel ? (
              <Button appearance="base" onClick={onCancel} type="button">
                Cancel edit
              </Button>
            ) : null}
            <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
              {editingPersona ? (formik.isSubmitting ? `Saving persona...` : `Save persona`) : cloneSource ? (formik.isSubmitting ? `Cloning persona...` : `Clone persona`) : formik.isSubmitting ? `Adding persona...` : `Add persona`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
