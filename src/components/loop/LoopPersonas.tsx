import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import { usePersonaList, usePersonaListAll } from "@components/persona/persona.query.js";
import { type FormEvent, useState } from "react";
import { isPersonaOwner, PersonaEditor, personaEditorKey } from "../persona/PersonaEditor.js";
import { assignPersonaToLoop, deletePersona } from "../persona/persona.client.js";
import type { Persona as PersonaRecord } from "../persona/persona.schema.js";
import type { LoopPersonasProps } from "./loop.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function LoopPersonas({ loopId, onFeedback }: LoopPersonasProps) {
  const currentUser = useCurrentUser();
  const { state: personaListState, reload: reloadPersonaList } = usePersonaList(loopId);
  const { state: personaListAllState } = usePersonaListAll();
  const [editingPersona, setEditingPersona] = useState<PersonaRecord | null>(null);
  const [cloneSource, setCloneSource] = useState<PersonaRecord | null>(null);
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [selectedGlobalPersonaId, setSelectedGlobalPersonaId] = useState(``);
  const [isAssigning, setIsAssigning] = useState(false);

  const assignedIds = personaListState.status === `success` ? new Set(personaListState.personas.map((p) => p.id)) : new Set<string>();

  const unassignedPersonaList = personaListAllState.status === `success` ? personaListAllState.personas.filter((p) => !assignedIds.has(p.id)) : [];

  const handleEditorSuccess = (message: string) => {
    onFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editingPersona ? `Persona updated` : `Persona added`,
      message,
    });
    setEditingPersona(null);
    setCloneSource(null);
    reloadPersonaList();
  };

  const handleEditorCancel = () => {
    setEditingPersona(null);
    setCloneSource(null);
  };

  const handleRemove = async (persona: PersonaRecord) => {
    setBusyPersonaId(persona.id);
    onFeedback(null);

    try {
      await deletePersona(loopId, persona.id);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona removed`,
        message: `${persona.displayName} has been removed from this loop.`,
      });

      if (editingPersona?.id === persona.id) {
        setEditingPersona(null);
        setCloneSource(null);
      }

      reloadPersonaList();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove persona`,
        message,
      });
    } finally {
      setBusyPersonaId(null);
    }
  };

  const handleAssignExisting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedGlobalPersonaId) {
      return;
    }

    setIsAssigning(true);
    onFeedback(null);

    try {
      await assignPersonaToLoop(loopId, selectedGlobalPersonaId);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona assigned`,
        message: `Persona has been assigned to this loop.`,
      });
      setSelectedGlobalPersonaId(``);
      reloadPersonaList();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to assign persona`,
        message,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const isOwner = (persona: PersonaRecord): boolean => isPersonaOwner(persona, currentUser);

  return (
    <>
      <PersonaEditor cloneSource={cloneSource} editingPersona={editingPersona} key={personaEditorKey(editingPersona, cloneSource)} loopId={loopId} onCancel={handleEditorCancel} onSuccess={handleEditorSuccess} />
      {unassignedPersonaList.length > 0 ? (
        <div className="p-strip is-shallow">
          <h2 className="p-heading--4">Assign an existing persona</h2>
          <form onSubmit={handleAssignExisting}>
            <Select
              id="assign-persona-select"
              label="Persona"
              onChange={(event) => setSelectedGlobalPersonaId(event.target.value)}
              options={[{ value: ``, label: `— Select a persona —` }, ...unassignedPersonaList.map((p) => ({ value: p.id, label: p.displayName }))]}
              value={selectedGlobalPersonaId}
            />
            <Button appearance="base" disabled={!selectedGlobalPersonaId || isAssigning} type="submit">
              {isAssigning ? `Assigning...` : `Assign persona`}
            </Button>
          </form>
        </div>
      ) : null}
      <div className="p-strip is-shallow">
        <h2 className="p-heading--4">Assigned personas</h2>
        {personaListState.status === `loading` ? <p className="p-text--default">Loading personas...</p> : null}
        {personaListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
            {personaListState.message}
          </Notification>
        ) : null}
        {personaListState.status === `success` && personaListState.personas.length === 0 ? <p className="p-text--default">No personas assigned to this loop yet. Add or assign a persona above.</p> : null}
        {personaListState.status === `success` && personaListState.personas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Coding harness` }, { content: `Status` }, { content: `Priority` }, { content: `Actions` }]}
            rows={personaListState.personas.map((persona) => ({
              key: persona.id,
              columns: [
                { content: persona.isRouting ? `${persona.displayName} (R)` : persona.displayName },
                { content: persona.usesCodingHarness ? `Yes` : `No` },
                { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                { content: persona.routingPriority },
                {
                  content: (
                    <div>
                      {isOwner(persona) ? (
                        <Button
                          appearance="base"
                          onClick={() => {
                            setCloneSource(null);
                            setEditingPersona(persona);
                          }}
                          type="button"
                        >
                          {`Edit ${persona.displayName}`}
                        </Button>
                      ) : (
                        <Button
                          appearance="base"
                          onClick={() => {
                            setEditingPersona(null);
                            setCloneSource(persona);
                          }}
                          type="button"
                        >
                          {`Clone & Edit ${persona.displayName}`}
                        </Button>
                      )}
                      {!persona.isDefault ? (
                        <Button appearance="negative" disabled={busyPersonaId === persona.id} onClick={() => handleRemove(persona)} type="button">
                          {busyPersonaId === persona.id ? `Removing ${persona.displayName}...` : `Remove ${persona.displayName}`}
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
  );
}
