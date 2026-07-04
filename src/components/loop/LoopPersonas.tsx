import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { usePersonaListAll } from "@components/persona/persona.query.js";
import { useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { useState } from "react";
import { isPersonaOwner, PersonaEditor, personaEditorKey } from "../persona/PersonaEditor.js";
import { assignPersonaToLoop, deletePersona } from "../persona/persona.client.js";
import type { Persona as PersonaRecord } from "../persona/persona.schema.js";
import type { LoopPersonasProps } from "./loop.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function LoopPersonas({ loopId, editor, personaId, personaListState, reloadPersonaList, onFeedback }: LoopPersonasProps) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { state: personaListAllState } = usePersonaListAll();
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);

  const assignedIds = personaListState.status === `success` ? new Set(personaListState.personas.map((p) => p.id)) : new Set<string>();

  const unassignedPersonaList = personaListAllState.status === `success` ? personaListAllState.personas.filter((p) => !assignedIds.has(p.id)) : [];

  const selectedPersona = personaListState.status === `success` && personaId ? (personaListState.personas.find((persona) => persona.id === personaId) ?? null) : null;

  const activeRoutingCount = personaListState.status === `success` ? personaListState.personas.filter((p) => p.isRouting && p.lifecycleStatus === `active`).length : null;

  const closeDrawer = () => {
    void navigate({ params: { loopId }, search: { tab: `personas`, create: undefined, edit: undefined, clone: undefined }, to: `/loop/$loopId` });
  };

  const openCreateDrawer = () => {
    void navigate({ params: { loopId }, search: { tab: `personas`, create: true, edit: undefined, clone: undefined }, to: `/loop/$loopId` });
    onFeedback(null);
  };

  const openEditDrawer = (persona: PersonaRecord) => {
    void navigate({ params: { loopId }, search: { tab: `personas`, create: undefined, edit: persona.id, clone: undefined }, to: `/loop/$loopId` });
    onFeedback(null);
  };

  const openCloneDrawer = (persona: PersonaRecord) => {
    void navigate({ params: { loopId }, search: { tab: `personas`, create: undefined, edit: persona.id, clone: true }, to: `/loop/$loopId` });
    onFeedback(null);
  };

  const handleEditorSuccess = (message: string) => {
    onFeedback({
      severity: editor === `edit` ? NotificationSeverity.INFORMATION : NotificationSeverity.INFORMATION,
      title: editor === `edit` ? `Persona updated` : `Persona added`,
      message,
    });
    closeDrawer();
    reloadPersonaList();
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

      if (editor && personaId === persona.id) {
        closeDrawer();
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

  const assignFormik = useFormik<{ selectedGlobalPersonaId: string }>({
    initialValues: { selectedGlobalPersonaId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedGlobalPersonaId) {
        return;
      }

      onFeedback(null);

      try {
        await assignPersonaToLoop(loopId, values.selectedGlobalPersonaId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Persona assigned`,
          message: `Persona has been assigned to this loop.`,
        });
        helpers.resetForm();
        reloadPersonaList();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign persona`,
          message,
        });
      }
    },
  });

  const isOwner = (persona: PersonaRecord): boolean => isPersonaOwner(persona, currentUser);

  const routingPausedReason =
    activeRoutingCount === 0
      ? `No active routing persona is assigned. Assign or activate a routing persona to resume the loop.`
      : activeRoutingCount !== null && activeRoutingCount > 1
        ? `${activeRoutingCount} active routing personas are assigned. Exactly one is required. Remove or archive the extras to resume the loop.`
        : null;

  return (
    <>
      {routingPausedReason ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Loop is paused">
          {routingPausedReason}
        </Notification>
      ) : null}
      {unassignedPersonaList.length > 0 ? (
        <div className="p-card p-strip is-shallow">
          <h2 className="p-heading--4">Assign an existing persona</h2>
          <form onSubmit={assignFormik.handleSubmit}>
            <Select
              id="assign-persona-select"
              label="Persona"
              name="selectedGlobalPersonaId"
              onChange={assignFormik.handleChange}
              options={[{ value: ``, label: `— Select a persona —` }, ...unassignedPersonaList.map((p) => ({ value: p.id, label: p.displayName }))]}
              value={assignFormik.values.selectedGlobalPersonaId}
            />
            <div className="u-align--right">
              <Button appearance="base" disabled={!assignFormik.values.selectedGlobalPersonaId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign persona`}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-6">
              <h2 className="p-heading--4">Assigned personas</h2>
            </div>
            <div className="p-grid__col-6 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Add persona
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
        {personaListState.status === `success` && personaListState.personas.length === 0 ? <p className="p-text--default">No personas assigned to this loop yet.</p> : null}
        {personaListState.status === `success` && personaListState.personas.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Role` }, { content: `Status` }, { content: `Actions` }]}
            rows={personaListState.personas.map((persona) => ({
              key: persona.id,
              columns: [
                { content: persona.isRouting ? `${persona.displayName} (R)` : persona.displayName },
                { content: persona.role ?? `-` },
                { content: lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus },
                {
                  content: (
                    <div className="u-align--right">
                      {isOwner(persona) ? (
                        <Button appearance="base" onClick={() => openEditDrawer(persona)} type="button">
                          {`Edit ${persona.displayName}`}
                        </Button>
                      ) : (
                        <Button appearance="base" onClick={() => openCloneDrawer(persona)} type="button">
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
      <EntityDrawer isOpen={Boolean(editor)} onClose={closeDrawer} title={editor === `edit` ? `Edit persona` : editor === `clone` ? `Clone persona` : `Add persona`}>
        {(editor === `edit` || editor === `clone`) && !selectedPersona ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Persona not found">
            The selected persona is not assigned to this loop.
          </Notification>
        ) : (
          <PersonaEditor
            cloneSource={editor === `clone` ? selectedPersona : null}
            editingPersona={editor === `edit` ? selectedPersona : null}
            key={personaEditorKey(editor === `edit` ? selectedPersona : null, editor === `clone` ? selectedPersona : null)}
            loopId={loopId}
            onCancel={closeDrawer}
            onSuccess={handleEditorSuccess}
          />
        )}
      </EntityDrawer>
    </>
  );
}
