import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { usePersonaCatalog, usePersonaListAll } from "@components/persona/persona.query.js";
import { useFormik } from "formik";
import { useState } from "react";
import { assignPersonaToLoop, unassignPersonaFromLoop } from "../persona/persona.client.js";
import type { Persona } from "../persona/persona.schema.js";
import type { LoopPersonasProps } from "./loop.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function LoopPersonas({ loopId, personaListState, reloadPersonaList, onFeedback }: LoopPersonasProps) {
  const { state: personaListAllState } = usePersonaListAll();
  const catalogState = usePersonaCatalog();
  const [busyPersonaId, setBusyPersonaId] = useState<string | null>(null);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);

  const assignedIds = personaListState.status === `success` ? new Set(personaListState.personas.map((p) => p.id)) : new Set<string>();

  // Combine owned personas and catalog personas, filtering out already assigned
  const unassignedPersonaList =
    personaListAllState.status === `success` && catalogState.status === `success` ? [...personaListAllState.personas.filter((p) => !assignedIds.has(p.id)), ...catalogState.catalog.filter((p) => !assignedIds.has(p.id))] : [];

  const activeRoutingCount = personaListState.status === `success` ? personaListState.personas.filter((p) => p.isRouting && p.lifecycleStatus === `active`).length : null;

  const handleRemove = async (persona: Persona) => {
    setBusyPersonaId(persona.id);
    onFeedback(null);

    try {
      await unassignPersonaFromLoop(loopId, persona.id);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona removed`,
        message: `${persona.displayName} has been removed from this loop.`,
      });

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
        setIsAssignDrawerOpen(false);
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
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-6">
              <h2 className="p-heading--4">Assigned personas</h2>
            </div>
            <div className="p-grid__col-6 u-align--right">
              <Button appearance="positive" onClick={() => setIsAssignDrawerOpen(true)} type="button">
                Assign persona
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
                      <Button appearance="negative" disabled={busyPersonaId === persona.id} onClick={() => handleRemove(persona)} type="button">
                        {busyPersonaId === persona.id ? `Removing ${persona.displayName}...` : `Remove ${persona.displayName}`}
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        ) : null}
      </div>
      <EntityDrawer isOpen={isAssignDrawerOpen} onClose={() => setIsAssignDrawerOpen(false)} title="Assign persona">
        {unassignedPersonaList.length === 0 ? (
          <Notification severity={NotificationSeverity.INFORMATION} title="No personas available">
            All available personas are already assigned to this loop.
          </Notification>
        ) : (
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
              <Button appearance="base" onClick={() => setIsAssignDrawerOpen(false)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={!assignFormik.values.selectedGlobalPersonaId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign`}
              </Button>
            </div>
          </form>
        )}
      </EntityDrawer>
    </>
  );
}
