import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { type FormEvent, useState } from "react";
import { createPersona, updatePersona } from "./persona.client.js";
import type { Persona as PersonaRecord, ReferencePersona } from "./persona.schema.js";
import { personaLifecycleStatuses } from "./persona.schema.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

type FormState = {
  displayName: string;
  personality: string;
  usesCodingHarness: boolean;
  lifecycleStatus: (typeof personaLifecycleStatuses)[number];
  routingPriority: number;
};

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
  routingPriority: 0,
});

type PersonaEditorProps = {
  loopId: string;
  editingPersona: PersonaRecord | null;
  catalogTemplates?: ReferencePersona[];
  onSuccess: (message: string) => void;
  onCancel?: () => void;
};

export function PersonaEditor({ loopId, editingPersona, catalogTemplates, onSuccess, onCancel }: PersonaEditorProps) {
  const [form, setForm] = useState<FormState>(
    editingPersona
      ? {
          displayName: editingPersona.displayName,
          personality: editingPersona.personality,
          usesCodingHarness: editingPersona.usesCodingHarness,
          lifecycleStatus: editingPersona.lifecycleStatus,
          routingPriority: editingPersona.routingPriority,
        }
      : emptyForm(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const applyTemplate = (ref: ReferencePersona) => {
    setForm({
      displayName: ref.displayName,
      personality: ref.personality,
      usesCodingHarness: ref.usesCodingHarness,
      lifecycleStatus: `active`,
      routingPriority: 0,
    });
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setFeedback(null);

    try {
      if (editingPersona) {
        await updatePersona(loopId, editingPersona.id, form);
        onSuccess(`${form.displayName} has been updated.`);
      } else {
        await createPersona(loopId, form);
        onSuccess(`${form.displayName} has been added to the loop.`);
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
              <Button appearance="base" key={ref.role} onClick={() => applyTemplate(ref)} type="button">
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
          <h2 className="p-heading--4">{editingPersona ? `Edit persona` : `Add persona`}</h2>
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
          <label htmlFor="persona-routing-priority">Routing priority</label>
          <input id="persona-routing-priority" min={0} name="persona-routing-priority" onChange={(event) => setForm((prev) => ({ ...prev, routingPriority: Number(event.target.value) }))} type="number" value={form.routingPriority} />
          <label>
            <input checked={form.usesCodingHarness} name="persona-uses-coding-harness" onChange={(event) => setForm((prev) => ({ ...prev, usesCodingHarness: event.target.checked }))} type="checkbox" />
            {` Uses coding harness`}
          </label>
          <div style={{ marginTop: `1rem` }}>
            <Button appearance="positive" disabled={isBusy} type="submit">
              {editingPersona ? (isBusy ? `Saving persona...` : `Save persona`) : isBusy ? `Adding persona...` : `Add persona`}
            </Button>
            {editingPersona && onCancel ? (
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
