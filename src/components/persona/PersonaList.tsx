import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { isPersonaOwner, PersonaEditor, personaEditorKey } from "./PersonaEditor.js";
import { usePersonaListAll } from "./persona.query.js";
import type { Feedback, Persona as PersonaRecord } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function PersonaList() {
  const currentUser = useCurrentUser();
  const { state: personaListState, reload: reloadPersonaList } = usePersonaListAll();
  const [editingPersona, setEditingPersona] = useState<PersonaRecord | null>(null);
  const [cloneSource, setCloneSource] = useState<PersonaRecord | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const resetEditor = () => {
    setEditingPersona(null);
    setCloneSource(null);
  };

  const handleEditorSuccess = (message: string) => {
    setFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editingPersona ? `Persona updated` : `Persona created`,
      message,
    });
    resetEditor();
    reloadPersonaList();
  };

  const isOwner = (persona: PersonaRecord): boolean => isPersonaOwner(persona, currentUser);

  return (
    <section className="athena-home">
      <p className="p-heading--5">Personas</p>
      <h1 className="p-heading--2">Personas</h1>
      <p className="p-text--default">{"Manage the global persona library. Personas can be assigned to loops from a loop's Personas tab."}</p>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <PersonaEditor cloneSource={cloneSource} editingPersona={editingPersona} key={personaEditorKey(editingPersona, cloneSource)} onCancel={resetEditor} onSuccess={handleEditorSuccess} />
      <div className="p-strip is-shallow">
        <h2 className="p-heading--4">All personas</h2>
        {personaListState.status === `loading` ? <p className="p-text--default">Loading personas...</p> : null}
        {personaListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
            {personaListState.message}
          </Notification>
        ) : null}
        {personaListState.status === `success` && personaListState.personas.length === 0 ? <p className="p-text--default">No personas yet. Create a persona above.</p> : null}
        {personaListState.status === `success` && personaListState.personas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Coding harness` }, { content: `Status` }, { content: `Actions` }]}
            rows={personaListState.personas.map((persona) => ({
              key: persona.id,
              columns: [
                {
                  content: (
                    <Link to={`/persona/$personaId`} params={{ personaId: persona.id }}>
                      {persona.isRouting ? `${persona.displayName} (R)` : persona.displayName}
                    </Link>
                  ),
                },
                { content: persona.usesCodingHarness ? `Yes` : `No` },
                { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                {
                  content: isOwner(persona) ? (
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
                  ),
                },
              ],
            }))}
          />
        ) : null}
      </div>
    </section>
  );
}
