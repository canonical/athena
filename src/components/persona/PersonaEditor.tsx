import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import type { User } from "@components/authentication/session.schema.js";
import { type FormEvent, useState } from "react";
import { assignPersonaToLoop, createPersona, updatePersona } from "./persona.client.js";
import type { Feedback, FormState, Persona as PersonaRecord, PersonaEditorProps } from "./persona.schema.js";
import { personaLifecycleStatuses } from "./persona.schema.js";

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

const emptyForm = (): FormState => ({
  displayName: ``,
  personality: ``,
  usesCodingHarness: false,
  lifecycleStatus: `active`,
});

export function PersonaEditor({ loopId, editingPersona, cloneSource, catalogTemplates, onSuccess, onCancel }: PersonaEditorProps) {
  const [form, setForm] = useState<FormState>(
    editingPersona
      ? {
          displayName: editingPersona.displayName,
          personality: editingPersona.personality,
          usesCodingHarness: editingPersona.usesCodingHarness,
          lifecycleStatus: editingPersona.lifecycleStatus,
        }
      : cloneSource
        ? {
            displayName: cloneSource.displayName,
            personality: cloneSource.personality,
            usesCodingHarness: cloneSource.usesCodingHarness,
            lifecycleStatus: cloneSource.lifecycleStatus,
          }
        : emptyForm(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const applyTemplate = (ref: PersonaRecord) => {
    setForm({
      displayName: ref.displayName,
      personality: ref.personality,
      usesCodingHarness: ref.usesCodingHarness,
      lifecycleStatus: `active`,
    });
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setFeedback(null);

    try {
      if (editingPersona) {
        await updatePersona(editingPersona.id, form);
        onSuccess(`${form.displayName} has been updated.`);
      } else {
        const created = await createPersona(form);
        if (loopId) {
          await assignPersonaToLoop(loopId, created.id);
          onSuccess(`${form.displayName} has been added to the loop.`);
        } else {
          onSuccess(`${form.displayName} has been created.`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: editingPersona ? `Unable to update persona` : `Unable to create persona`,
        message,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      {catalogTemplates && catalogTemplates.length > 0 ? (
        <div className="p-strip is-shallow">
          <h2 className="p-heading--4">Reference persona templates</h2>
          <p className="p-text--default">Select a reference persona to pre-fill the form below with a standard personality definition.</p>
          <div style={{ display: `flex`, flexWrap: `wrap`, gap: `0.5rem` }}>
            {catalogTemplates.map((ref) => (
              <Button appearance="base" key={ref.id} onClick={() => applyTemplate(ref)} type="button">
                {ref.displayName}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="p-strip is-shallow">
        {feedback ? (
          <Notification severity={feedback.severity} title={feedback.title}>
            {feedback.message}
          </Notification>
        ) : null}
        <form onSubmit={handleSubmit}>
          <h2 className="p-heading--4">{editingPersona ? `Edit persona` : cloneSource ? `Clone persona` : `Add persona`}</h2>
          <label htmlFor="persona-display-name">Display name</label>
          <input id="persona-display-name" name="persona-display-name" onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} required type="text" value={form.displayName} />
          <label htmlFor="persona-personality">Personality</label>
          <textarea id="persona-personality" name="persona-personality" onChange={(event) => setForm((prev) => ({ ...prev, personality: event.target.value }))} required rows={6} value={form.personality} />
          <Select
            id="persona-lifecycle-status"
            label="Lifecycle status"
            name="persona-lifecycle-status"
            onChange={(event) => setForm((prev) => ({ ...prev, lifecycleStatus: event.target.value as (typeof personaLifecycleStatuses)[number] }))}
            options={personaLifecycleStatuses.map((status) => ({ value: status, label: lifecycleStatusLabel[status] ?? status }))}
            value={form.lifecycleStatus}
          />
          <label>
            <input checked={form.usesCodingHarness} name="persona-uses-coding-harness" onChange={(event) => setForm((prev) => ({ ...prev, usesCodingHarness: event.target.checked }))} type="checkbox" />
            {` Uses coding harness`}
          </label>
          <div style={{ marginTop: `1rem` }}>
            <Button appearance="positive" disabled={isBusy} type="submit">
              {editingPersona ? (isBusy ? `Saving persona...` : `Save persona`) : cloneSource ? (isBusy ? `Cloning persona...` : `Clone persona`) : isBusy ? `Adding persona...` : `Add persona`}
            </Button>
            {(editingPersona || cloneSource) && onCancel ? (
              <Button appearance="base" onClick={onCancel} type="button">
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
