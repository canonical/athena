import { Button, Form, Input, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isPersonaOwner, PersonaEditor, personaEditorKey } from "./PersonaEditor.js";
import { createPersona, deletePersona } from "./persona.client.js";
import { usePersonaCatalog, usePersonaListAll } from "./persona.query.js";
import type { Feedback, Persona } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type PersonaListProps = {
  tab?: `my-personas` | `catalog`;
  editor?: `create` | `edit` | `clone`;
  personaId?: string;
};

export function PersonaList({ tab = `my-personas`, editor, personaId }: PersonaListProps) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const { state: personaListState } = usePersonaListAll();
  const catalogState = usePersonaCatalog();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [catalogCloneSource, setCatalogCloneSource] = useState<Persona | null>(null);
  const [cloneName, setCloneName] = useState<string>(``);
  const [isCloning, setIsCloning] = useState(false);

  // Ensure persona list is refreshed when currentUser loads to recalculate ownership
  useEffect(() => {
    if (currentUser) {
      void queryClient.invalidateQueries({ queryKey: [`personas`] });
    }
  }, [currentUser?.id, queryClient]);

  // Filter owned personas for "My Personas" tab
  const ownedPersonas = personaListState.status === `success` ? personaListState.personas.filter((p) => isPersonaOwner(p, currentUser)) : [];

  // Get catalog personas for "Persona Catalog" tab
  const catalogPersonas = catalogState.status === `success` ? catalogState.catalog : [];

  // Select appropriate data based on active tab
  const displayPersonas = tab === `catalog` ? catalogPersonas : ownedPersonas;
  const isLoadingPersonas = tab === `my-personas` ? personaListState.status === `loading` : catalogState.status === `loading`;
  const isErrorPersonas = tab === `my-personas` ? personaListState.status === `error` : catalogState.status === `error`;
  const errorMessage = tab === `my-personas` ? (personaListState.status === `error` ? personaListState.message : ``) : catalogState.status === `error` ? catalogState.message : ``;

  const selectedPersona = tab === `my-personas` && personaId ? (ownedPersonas.find((persona) => persona.id === personaId) ?? null) : null;

  const closeDrawer = () => {
    void navigate({ to: `/persona/list`, search: { tab, create: undefined, edit: undefined, clone: undefined } });
  };

  const openCreateDrawer = () => {
    void navigate({ to: `/persona/list`, search: { tab: `my-personas`, create: true, edit: undefined, clone: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (persona: Persona) => {
    void navigate({ to: `/persona/list`, search: { tab: `my-personas`, create: undefined, edit: persona.id, clone: undefined } });
    setFeedback(null);
  };

  const handleEditorSuccess = async (message: string) => {
    setFeedback({
      severity: NotificationSeverity.INFORMATION,
      title: editor === `edit` ? `Persona updated` : `Persona created`,
      message,
    });
    await queryClient.refetchQueries({ queryKey: [`personas`] });
    await queryClient.refetchQueries({ queryKey: [`currentUser`] });
    closeDrawer();
  };

  const handleDelete = async (persona: Persona) => {
    setBusyPersonaId(persona.id);
    setFeedback(null);

    try {
      await deletePersona(persona.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona deleted`,
        message: `${persona.displayName} has been deleted.`,
      });
      await queryClient.refetchQueries({ queryKey: [`personas`] });
      await queryClient.refetchQueries({ queryKey: [`currentUser`] });

      if (editor === `edit` && personaId === persona.id) {
        closeDrawer();
      }
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

  const setTab = (newTab: `my-personas` | `catalog`) => {
    void navigate({ to: `/persona/list`, search: { tab: newTab, create: undefined, edit: undefined, clone: undefined } });
  };

  const openCatalogCloneDrawer = (persona: Persona) => {
    setCatalogCloneSource(persona);
    setCloneName(``);
    setFeedback(null);
  };

  const closeCatalogCloneDrawer = () => {
    setCatalogCloneSource(null);
    setCloneName(``);
  };

  const handleCatalogClone = async () => {
    if (!catalogCloneSource || !cloneName.trim() || !currentUser) {
      return;
    }

    setIsCloning(true);
    setFeedback(null);

    try {
      await createPersona({
        displayName: cloneName,
        role: catalogCloneSource.role,
        personality: catalogCloneSource.personality,
        lifecycleStatus: catalogCloneSource.lifecycleStatus,
      });

      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona cloned`,
        message: `${cloneName} has been created.`,
      });

      await queryClient.refetchQueries({ queryKey: [`personas`] });
      await queryClient.refetchQueries({ queryKey: [`currentUser`] });

      // Switch to My Personas tab to show newly cloned persona
      void navigate({ to: `/persona/list`, search: { tab: `my-personas`, create: undefined, edit: undefined, clone: undefined } });
      closeCatalogCloneDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to clone persona`,
        message,
      });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Personas</h1>
      <nav className="p-tabs">
        <div role="tablist">
          <ul className="p-tabs__list">
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `my-personas`} className={`p-tabs__link${tab === `my-personas` ? ` is-active` : ``}`} onClick={() => setTab(`my-personas`)} role="tab" type="button">
                My Personas
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `catalog`} className={`p-tabs__link${tab === `catalog` ? ` is-active` : ``}`} onClick={() => setTab(`catalog`)} role="tab" type="button">
                Persona Catalog
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-6">
              <h2 className="p-heading--4">{tab === `catalog` ? `Persona Catalog` : `My Personas`}</h2>
            </div>
            {tab === `my-personas` ? (
              <div className="p-grid__col-6 u-align--right">
                <Button appearance="positive" onClick={openCreateDrawer} type="button">
                  Create persona
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {isLoadingPersonas ? <p className="p-text--default">Loading personas...</p> : null}
        {isErrorPersonas ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load personas">
            {errorMessage}
          </Notification>
        ) : null}
        {!isLoadingPersonas && !isErrorPersonas && displayPersonas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Role` }, { content: `Status` }, ...(tab === `my-personas` ? [{ content: `Actions` }] : tab === `catalog` ? [{ content: `Actions` }] : [])]}
            rows={displayPersonas.map((persona) => ({
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
                ...(tab === `my-personas`
                  ? [
                      {
                        content: (
                          <div className="u-align--right">
                            <Button appearance="base" onClick={() => openEditDrawer(persona)} type="button">
                              {`Edit ${persona.displayName}`}
                            </Button>
                            <Button appearance="negative" disabled={busyPersonaId === persona.id} onClick={() => void handleDelete(persona)} type="button">
                              {busyPersonaId === persona.id ? `Deleting ${persona.displayName}...` : `Delete ${persona.displayName}`}
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : tab === `catalog`
                    ? [
                        {
                          content: (
                            <div className="u-align--right">
                              <Button appearance="positive" onClick={() => openCatalogCloneDrawer(persona)} type="button">
                                {`Clone ${persona.displayName}`}
                              </Button>
                            </div>
                          ),
                        },
                      ]
                    : []),
              ],
            }))}
          />
        ) : !isLoadingPersonas && !isErrorPersonas ? (
          <p className="p-text--default">{tab === `catalog` ? `No personas in catalog.` : `No personas yet.`}</p>
        ) : null}
      </div>
      {tab === `my-personas` ? (
        <EntityDrawer isOpen={Boolean(editor)} onClose={closeDrawer} title={editor === `edit` ? `Edit persona` : editor === `clone` ? `Clone persona` : `Create persona`}>
          {(editor === `edit` || editor === `clone`) && !selectedPersona ? (
            <Notification severity={NotificationSeverity.CAUTION} title="Persona not found">
              The selected persona no longer exists.
            </Notification>
          ) : (
            <PersonaEditor
              cloneSource={editor === `clone` ? selectedPersona : null}
              editingPersona={editor === `edit` ? selectedPersona : null}
              isDeleting={Boolean(editor === `edit` && selectedPersona && busyPersonaId === selectedPersona.id)}
              key={personaEditorKey(editor === `edit` ? selectedPersona : null, editor === `clone` ? selectedPersona : null)}
              onCancel={closeDrawer}
              onDelete={editor === `edit` ? handleDelete : undefined}
              onSuccess={handleEditorSuccess}
            />
          )}
        </EntityDrawer>
      ) : null}
      <EntityDrawer isOpen={Boolean(catalogCloneSource)} onClose={closeCatalogCloneDrawer} title={`Clone persona`}>
        {catalogCloneSource ? (
          <div>
            <p className="p-text--default">
              Cloning <strong>{catalogCloneSource.displayName}</strong> from the catalog. Enter a name for your cloned persona.
            </p>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCatalogClone();
              }}
            >
              <Input autoFocus disabled={isCloning} label="Persona name" onChange={(e) => setCloneName(e.target.value)} placeholder="Enter persona name" type="text" value={cloneName} />
              <div className="p-grid">
                <div className="p-grid__row u-align--right">
                  <Button appearance="base" disabled={isCloning} onClick={closeCatalogCloneDrawer} type="button">
                    Cancel
                  </Button>
                  <Button appearance="positive" disabled={!cloneName.trim() || isCloning} type="submit">
                    {isCloning ? `Cloning...` : `Clone`}
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        ) : null}
      </EntityDrawer>
    </section>
  );
}
