import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useAllPersonas } from "@components/persona/persona.query.js";
import { type FormEvent, useState } from "react";
import { PersonaEditor } from "../persona/PersonaEditor.js";
import { assignPersonaToLoop, deletePersona } from "../persona/persona.client.js";
import { usePersonas } from "../persona/persona.query.js";
import type { Persona as PersonaRecord } from "../persona/persona.schema.js";
import { updateLoop } from "./loop.client.js";
import { useLoop } from "./loop.query.js";
import { loopUpdateSchema } from "./loop.schema.js";

type Tab = "details" | "personas";

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

type LoopDetailProps = {
  loopId: string;
};

export function LoopDetail({ loopId }: LoopDetailProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const [activeTab, setActiveTab] = useState<Tab>(`details`);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loop = loopState.status === `success` ? loopState.loop : null;

  if (loopState.status === `loading`) {
    return (
      <section className="athena-home">
        <p className="p-text--default">Loading loop...</p>
      </section>
    );
  }

  if (loopState.status === `error`) {
    return (
      <section className="athena-home">
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop">
          {loopState.message}
        </Notification>
      </section>
    );
  }

  return (
    <section className="athena-home">
      <p className="p-heading--5">Loops</p>
      <h1 className="p-heading--2">{loop?.name ?? `Loop`}</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <nav className="p-tabs">
        <ul className="p-tabs__list" role="tablist">
          <li className="p-tabs__item" role="presentation">
            <button
              aria-selected={activeTab === `details`}
              className={`p-tabs__link${activeTab === `details` ? ` is-active` : ``}`}
              onClick={() => {
                setActiveTab(`details`);
                setFeedback(null);
              }}
              role="tab"
              type="button"
            >
              Details
            </button>
          </li>
          <li className="p-tabs__item" role="presentation">
            <button
              aria-selected={activeTab === `personas`}
              className={`p-tabs__link${activeTab === `personas` ? ` is-active` : ``}`}
              onClick={() => {
                setActiveTab(`personas`);
                setFeedback(null);
              }}
              role="tab"
              type="button"
            >
              Personas
            </button>
          </li>
        </ul>
      </nav>
      {activeTab === `details` ? <LoopDetailsTab loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} onFeedback={setFeedback} onSaved={reloadLoop} /> : null}
      {activeTab === `personas` ? <LoopPersonasTab loopId={loopId} onFeedback={setFeedback} /> : null}
    </section>
  );
}

type LoopDetailsTabProps = {
  loopId: string;
  loopName: string;
  loopDescription: string;
  onFeedback: (feedback: Feedback | null) => void;
  onSaved: () => void;
};

function LoopDetailsTab({ loopId, loopName, loopDescription, onFeedback, onSaved }: LoopDetailsTabProps) {
  const [editName, setEditName] = useState(loopName);
  const [editDescription, setEditDescription] = useState(loopDescription);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = loopUpdateSchema.safeParse({ name: editName, description: editDescription });

    if (!parseResult.success) {
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update loop`,
        message: parseResult.error.issues[0]?.message ?? `Invalid input.`,
      });
      return;
    }

    setIsSaving(true);
    onFeedback(null);

    try {
      const updated = await updateLoop(loopId, { name: editName, description: editDescription });
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop updated`,
        message: `${updated.name} has been updated.`,
      });
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update loop`,
        message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-strip is-shallow">
      <form onSubmit={handleSave}>
        <h2 className="p-heading--4">Loop details</h2>
        <label htmlFor="loop-detail-name">Loop name</label>
        <input id="loop-detail-name" name="loop-detail-name" onChange={(event) => setEditName(event.target.value)} required type="text" value={editName} />
        <label htmlFor="loop-detail-description">Loop description</label>
        <textarea id="loop-detail-description" name="loop-detail-description" onChange={(event) => setEditDescription(event.target.value)} rows={3} value={editDescription} />
        <Button appearance="positive" disabled={isSaving} type="submit">
          {isSaving ? `Saving loop...` : `Save loop`}
        </Button>
      </form>
    </div>
  );
}

type LoopPersonasTabProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};

function LoopPersonasTab({ loopId, onFeedback }: LoopPersonasTabProps) {
  const { state: personasState, reload: reloadPersonas } = usePersonas(loopId);
  const { state: allPersonasState } = useAllPersonas();
  const [editingPersona, setEditingPersona] = useState<PersonaRecord | null>(null);
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [selectedGlobalPersonaId, setSelectedGlobalPersonaId] = useState(``);
  const [isAssigning, setIsAssigning] = useState(false);

  const assignedIds = personasState.status === `success` ? new Set(personasState.personas.map((p) => p.id)) : new Set<string>();

  const unassignedPersonas = allPersonasState.status === `success` ? allPersonasState.personas.filter((p) => !assignedIds.has(p.id)) : [];

  const handleEditorSuccess = (message: string) => {
    onFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editingPersona ? `Persona updated` : `Persona added`,
      message,
    });
    setEditingPersona(null);
    reloadPersonas();
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
      }

      reloadPersonas();
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
      reloadPersonas();
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

  return (
    <>
      <PersonaEditor editingPersona={editingPersona} key={editingPersona?.id ?? `new`} loopId={loopId} onCancel={() => setEditingPersona(null)} onSuccess={handleEditorSuccess} />
      {unassignedPersonas.length > 0 ? (
        <div className="p-strip is-shallow">
          <h2 className="p-heading--4">Assign an existing persona</h2>
          <form onSubmit={handleAssignExisting}>
            <Select
              id="assign-persona-select"
              label="Persona"
              onChange={(event) => setSelectedGlobalPersonaId(event.target.value)}
              options={[{ value: ``, label: `— Select a persona —` }, ...unassignedPersonas.map((p) => ({ value: p.id, label: p.displayName }))]}
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
        {personasState.status === `loading` ? <p className="p-text--default">Loading personas...</p> : null}
        {personasState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
            {personasState.message}
          </Notification>
        ) : null}
        {personasState.status === `success` && personasState.personas.length === 0 ? <p className="p-text--default">No personas assigned to this loop yet. Add or assign a persona above.</p> : null}
        {personasState.status === `success` && personasState.personas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Coding harness` }, { content: `Status` }, { content: `Priority` }, { content: `Actions` }]}
            rows={personasState.personas.map((persona) => ({
              key: persona.id,
              columns: [
                { content: persona.isDecisionMaker ? `${persona.displayName} (DM)` : persona.displayName },
                { content: persona.usesCodingHarness ? `Yes` : `No` },
                { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                { content: persona.routingPriority },
                {
                  content: (
                    <div>
                      <Button appearance="base" onClick={() => setEditingPersona(persona)} type="button">
                        {`Edit ${persona.displayName}`}
                      </Button>
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
