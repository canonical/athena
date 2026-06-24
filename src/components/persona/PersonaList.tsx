import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useLoops } from "@components/loop/loop.query.js";
import { useState } from "react";
import { PersonaEditor } from "./PersonaEditor.js";
import { deletePersona } from "./persona.client.js";
import { usePersonaCatalog, usePersonas } from "./persona.query.js";
import type { Persona as PersonaRecord } from "./persona.schema.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function PersonaList() {
  const { state: loopsState } = useLoops();
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const { state: personasState, reload: reloadPersonas } = usePersonas(selectedLoopId);
  const catalogState = usePersonaCatalog();

  const [editingPersona, setEditingPersona] = useState<PersonaRecord | null>(null);
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loops = loopsState.status === `success` ? loopsState.loops : [];

  const resetEditor = () => {
    setEditingPersona(null);
  };

  const startEditing = (persona: PersonaRecord) => {
    setEditingPersona(persona);
    setFeedback(null);
  };

  const handleEditorSuccess = (message: string) => {
    setFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editingPersona ? `Persona updated` : `Persona created`,
      message,
    });
    resetEditor();
    reloadPersonas();
  };

  const handleDelete = async (persona: PersonaRecord) => {
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
        resetEditor();
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
              resetEditor();
              setFeedback(null);
            }}
            options={[{ value: ``, label: `— Select a loop —` }, ...loops.map((loop) => ({ value: loop.id, label: loop.name }))]}
            value={selectedLoopId ?? ``}
          />
        ) : null}
      </div>
      {selectedLoopId ? (
        <>
          <PersonaEditor
            catalogTemplates={catalogState.status === `success` ? catalogState.catalog : undefined}
            editingPersona={editingPersona}
            key={editingPersona?.id ?? `new`}
            loopId={selectedLoopId}
            onCancel={resetEditor}
            onSuccess={handleEditorSuccess}
          />
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
                          {!persona.isDefault ? (
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
