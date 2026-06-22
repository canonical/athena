import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useLoops } from "@components/loop/loop.query.js";
import { type FormEvent, useState } from "react";
import { createPersona, deletePersona, updatePersona } from "./persona.client.js";
import { usePersonaCatalog, usePersonas } from "./persona.query.js";
import type { Persona as PersonaRecord, ReferencePersona } from "./persona.schema.js";
import { personaLifecycleStatuses } from "./persona.schema.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

type PersonaItem = PersonaRecord;

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

const emptyForm = () => ({
  displayName: ``,
  personality: ``,
  usesCodingHarness: false,
  lifecycleStatus: `active` as const,
  routingPriority: 0,
});

export function Persona() {
  const { state: loopsState } = useLoops();
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const { state: personasState, reload: reloadPersonas } = usePersonas(selectedLoopId);
  const catalogState = usePersonaCatalog();

  const [form, setForm] = useState(emptyForm());
  const [editingPersona, setEditingPersona] = useState<PersonaItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loops = loopsState.status === `success` ? loopsState.loops : [];

  const resetForm = () => {
    setForm(emptyForm());
    setEditingPersona(null);
    setIsSaving(false);
  };

  const startEditing = (persona: PersonaItem) => {
    setEditingPersona(persona);
    setForm({
      displayName: persona.displayName,
      personality: persona.personality,
      usesCodingHarness: persona.usesCodingHarness,
      lifecycleStatus: persona.lifecycleStatus,
      routingPriority: persona.routingPriority,
    });
    setFeedback(null);
  };

  const applyTemplate = (ref: ReferencePersona) => {
    setEditingPersona(null);
    setForm({
      displayName: ref.displayName,
      personality: ref.personality,
      usesCodingHarness: ref.usesCodingHarness,
      lifecycleStatus: `active`,
      routingPriority: 0,
    });
    setFeedback(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedLoopId) {
      return;
    }

    setIsCreating(true);
    setFeedback(null);

    try {
      await createPersona(selectedLoopId, form);
      setForm(emptyForm());
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona created`,
        message: `${form.displayName} has been added to the loop.`,
      });
      reloadPersonas();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to create persona`,
        message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingPersona || !selectedLoopId) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await updatePersona(selectedLoopId, editingPersona.id, form);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona updated`,
        message: `${form.displayName} has been updated.`,
      });
      resetForm();
      reloadPersonas();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update persona`,
        message,
      });
      setIsSaving(false);
    }
  };

  const handleDelete = async (persona: PersonaItem) => {
    if (!selectedLoopId) {
      return;
    }

    setBusyPersonaId(persona.id);
    setFeedback(null);

    try {
      await deletePersona(selectedLoopId, persona.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona deleted`,
        message: `${persona.displayName} has been deleted.`,
      });

      if (editingPersona?.id === persona.id) {
        resetForm();
      }

      reloadPersonas();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete persona`,
        message,
      });
    } finally {
      setBusyPersonaId(null);
    }
  };

  const isFormForEditing = Boolean(editingPersona);

  return (
    <section className="athena-home">
      <p className="p-heading--5">Personas</p>
      <h1 className="p-heading--2">Personas</h1>
      <p className="p-text--default">Configure persona profiles for each loop. Each loop requires at least one engineering manager and one coding harness persona.</p>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-strip is-shallow">
        <h2 className="p-heading--4">Select loop</h2>
        {loopsState.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
        {loopsState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
            {loopsState.message}
          </Notification>
        ) : null}
        {loopsState.status === `success` && loops.length === 0 ? <p className="p-text--default">No loops available. Create a loop first.</p> : null}
        {loopsState.status === `success` && loops.length > 0 ? (
          <Select
            id="loop-select"
            label="Loop"
            onChange={(event) => {
              setSelectedLoopId(event.target.value || null);
              resetForm();
              setFeedback(null);
            }}
            options={[{ value: ``, label: `— Select a loop —` }, ...loops.map((loop) => ({ value: loop.id, label: loop.name }))]}
            value={selectedLoopId ?? ``}
          />
        ) : null}
      </div>
      {selectedLoopId ? (
        <>
          {catalogState.status === `success` && catalogState.catalog.length > 0 ? (
            <div className="p-strip is-shallow">
              <h2 className="p-heading--4">Reference persona templates</h2>
              <p className="p-text--default">Select a reference persona to pre-fill the form below with a standard personality definition.</p>
              <div style={{ display: `flex`, flexWrap: `wrap`, gap: `0.5rem` }}>
                {catalogState.catalog.map((ref) => (
                  <Button appearance="base" key={ref.role} onClick={() => applyTemplate(ref)} type="button">
                    {ref.displayName}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="p-strip is-shallow">
            <form onSubmit={isFormForEditing ? handleSave : handleCreate}>
              <h2 className="p-heading--4">{isFormForEditing ? `Edit persona` : `Add persona`}</h2>
              <label htmlFor="persona-display-name">Display name</label>
              <input id="persona-display-name" name="persona-display-name" onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} required type="text" value={form.displayName} />
              <label htmlFor="persona-personality">Personality</label>
              <textarea id="persona-personality" name="persona-personality" onChange={(event) => setForm((prev) => ({ ...prev, personality: event.target.value }))} required rows={6} value={form.personality} />
              <label htmlFor="persona-lifecycle-status">Lifecycle status</label>
              <select
                id="persona-lifecycle-status"
                name="persona-lifecycle-status"
                onChange={(event) => setForm((prev) => ({ ...prev, lifecycleStatus: event.target.value as (typeof personaLifecycleStatuses)[number] }))}
                value={form.lifecycleStatus}
              >
                {personaLifecycleStatuses.map((status) => (
                  <option key={status} value={status}>
                    {lifecycleStatusLabel[status] ?? status}
                  </option>
                ))}
              </select>
              <label htmlFor="persona-routing-priority">Routing priority</label>
              <input id="persona-routing-priority" min={0} name="persona-routing-priority" onChange={(event) => setForm((prev) => ({ ...prev, routingPriority: Number(event.target.value) }))} type="number" value={form.routingPriority} />
              <label>
                <input checked={form.usesCodingHarness} name="persona-uses-coding-harness" onChange={(event) => setForm((prev) => ({ ...prev, usesCodingHarness: event.target.checked }))} type="checkbox" />
                {` Uses coding harness`}
              </label>
              <div style={{ marginTop: `1rem` }}>
                <Button appearance="positive" disabled={isCreating || isSaving} type="submit">
                  {isFormForEditing ? (isSaving ? `Saving persona...` : `Save persona`) : isCreating ? `Adding persona...` : `Add persona`}
                </Button>
                {isFormForEditing ? (
                  <Button appearance="base" onClick={resetForm} type="button">
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </div>
          <div className="p-strip is-shallow">
            <h2 className="p-heading--4">Configured personas</h2>
            {personasState.status === `loading` ? <p className="p-text--default">Loading personas...</p> : null}
            {personasState.status === `error` ? (
              <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
                {personasState.message}
              </Notification>
            ) : null}
            {personasState.status === `success` && personasState.personas.length === 0 ? <p className="p-text--default">No personas configured for this loop yet. Add a persona to get started.</p> : null}
            {personasState.status === `success` && personasState.personas.length > 0 ? (
              <MainTable
                headers={[{ content: `Display name` }, { content: `Coding harness` }, { content: `Status` }, { content: `Priority` }, { content: `Actions` }]}
                rows={personasState.personas.map((persona) => ({
                  key: persona.id,
                  columns: [
                    { content: persona.isEngineeringManager ? `${persona.displayName} (EM)` : persona.displayName },
                    { content: persona.usesCodingHarness ? `Yes` : `No` },
                    { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                    { content: persona.routingPriority },
                    {
                      content: (
                        <div>
                          <Button appearance="base" onClick={() => startEditing(persona)} type="button">
                            {`Edit ${persona.displayName}`}
                          </Button>
                          {!persona.isEngineeringManager ? (
                            <Button appearance="negative" disabled={busyPersonaId === persona.id} onClick={() => handleDelete(persona)} type="button">
                              {busyPersonaId === persona.id ? `Deleting ${persona.displayName}...` : `Delete ${persona.displayName}`}
                            </Button>
                          ) : null}
                        </div>
                      ),
                    },
                  ],
                }))}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
