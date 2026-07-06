import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { isPersonaOwner, PersonaEditor, personaEditorKey } from "./PersonaEditor.js";
import { usePersonaListAll } from "./persona.query.js";
import type { Feedback, Persona as PersonaRecord } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type PersonaListProps = {
  editor?: `create` | `edit` | `clone`;
  personaId?: string;
};

export function PersonaList({ editor, personaId }: PersonaListProps) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { state: personaListState, reload: reloadPersonaList } = usePersonaListAll();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedPersona = personaListState.status === `success` && personaId ? (personaListState.personas.find((persona) => persona.id === personaId) ?? null) : null;

  const closeDrawer = () => {
    void navigate({ to: `/persona/list`, search: { create: undefined, edit: undefined, clone: undefined } });
  };

  const openCreateDrawer = () => {
    void navigate({ to: `/persona/list`, search: { create: true, edit: undefined, clone: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (persona: PersonaRecord) => {
    void navigate({ to: `/persona/list`, search: { create: undefined, edit: persona.id, clone: undefined } });
    setFeedback(null);
  };

  const openCloneDrawer = (persona: PersonaRecord) => {
    void navigate({ to: `/persona/list`, search: { create: undefined, edit: persona.id, clone: true } });
    setFeedback(null);
  };

  const handleEditorSuccess = (message: string) => {
    setFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editor === `edit` ? `Persona updated` : `Persona created`,
      message,
    });
    closeDrawer();
    reloadPersonaList();
  };

  const isOwner = (persona: PersonaRecord): boolean => isPersonaOwner(persona, currentUser);

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Personas</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-6">
              <h2 className="p-heading--4">All personas</h2>
            </div>
            <div className="p-grid__col-6 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create persona
              </Button>
            </div>
          </div>
        </div>
        {personaListState.status === `loading` ? <p className="p-text--default">Loading personas...</p> : null}
        {personaListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
            {personaListState.message}
          </Notification>
        ) : null}
        {personaListState.status === `success` && personaListState.personas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Role` }, { content: `Status` }, { content: `Actions` }]}
            rows={personaListState.personas.map((persona) => ({
              key: persona.id,
              columns: [
                {
                  content: (
                    <Link params={{ personaId: persona.id }} to={`/persona/$personaId`}>
                      {persona.isRouting ? `${persona.displayName} (R)` : persona.displayName}
                    </Link>
                  ),
                },
                { content: persona.role ?? `-` },
                { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                {
                  content: isOwner(persona) ? (
                    <div className="u-align--right">
                      <Button appearance="base" onClick={() => openEditDrawer(persona)} type="button">
                        {`Edit ${persona.displayName}`}
                      </Button>
                    </div>
                  ) : (
                    <div className="u-align--right">
                      <Button appearance="base" onClick={() => openCloneDrawer(persona)} type="button">
                        {`Clone & Edit ${persona.displayName}`}
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        ) : personaListState.status === `success` ? (
          <p className="p-text--default">No personas yet.</p>
        ) : null}
      </div>
      <EntityDrawer isOpen={Boolean(editor)} onClose={closeDrawer} title={editor === `edit` ? `Edit persona` : editor === `clone` ? `Clone persona` : `Create persona`}>
        {(editor === `edit` || editor === `clone`) && !selectedPersona ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Persona not found">
            The selected persona no longer exists.
          </Notification>
        ) : (
          <PersonaEditor
            cloneSource={editor === `clone` ? selectedPersona : null}
            editingPersona={editor === `edit` ? selectedPersona : null}
            key={personaEditorKey(editor === `edit` ? selectedPersona : null, editor === `clone` ? selectedPersona : null)}
            onCancel={closeDrawer}
            onSuccess={handleEditorSuccess}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
