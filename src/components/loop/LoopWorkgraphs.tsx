import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { assignWorkgraphToLoop, removeWorkgraphFromLoop, updateLoopWorkgraphByAdmin } from "@components/workgraph/workgraph.client.js";
import { useLoopWorkgraphList, useWorkgraphList, useWorkgraphTypeOptions } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, WorkgraphSeedItem } from "@components/workgraph/workgraph.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopWorkgraphsProps } from "./loop.schema.js";

const formatTimestamp = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : `-`);

const statusLabels: Record<`never` | `ok` | `failed`, string> = {
  never: `Never synced`,
  ok: `Last sync succeeded`,
  failed: `Last sync failed`,
};

const parseSeedItemsInput = (value: string): { items: WorkgraphSeedItem[]; error?: string } => {
  const items = value
    .split(`\n`)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { items };
};

const seedItemsPreview = (seedItems: WorkgraphSeedItem[]) => {
  if (seedItems.length === 0) {
    return `-`;
  }

  return seedItems.slice(0, 2).join(`, `);
};

export function LoopWorkgraphs({ loopId, onFeedback }: LoopWorkgraphsProps) {
  const queryClient = useQueryClient();
  const { state: workgraphListState } = useWorkgraphList();
  const { state: assignedWorkgraphState, reload: reloadAssignedWorkgraphs } = useLoopWorkgraphList(loopId);
  const { state: workgraphTypeOptionState } = useWorkgraphTypeOptions();
  const [busyWorkgraphId, setBusyWorkgraphId] = useState<string | null>(null);
  const [editingWorkgraphId, setEditingWorkgraphId] = useState<string | null>(null);

  const availableWorkgraphs = workgraphListState.status === `success` ? workgraphListState.workgraphs : [];
  const assignedWorkgraphs = assignedWorkgraphState.status === `success` ? assignedWorkgraphState.workgraphs : [];

  const assignedWorkgraphIds = new Set(assignedWorkgraphs.map((workgraph) => workgraph.workgraph));
  const unassignedWorkgraphs = availableWorkgraphs.filter((workgraph) => !assignedWorkgraphIds.has(workgraph.id));

  const assignFormik = useFormik<{ selectedWorkgraphId: string }>({
    initialValues: { selectedWorkgraphId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedWorkgraphId) {
        return;
      }

      onFeedback(null);

      try {
        await assignWorkgraphToLoop(loopId, values.selectedWorkgraphId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Workgraph assigned`,
          message: `Workgraph has been assigned to this loop.`,
        });
        helpers.resetForm();
        await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
        reloadAssignedWorkgraphs();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign workgraph`,
          message,
        });
      }
    },
  });

  const updateFormik = useFormik<{
    seedItemsInput: string;
    includeSubtasks: `true` | `false`;
    statusesCsv: string;
  }>({
    enableReinitialize: true,
    initialValues: {
      seedItemsInput: ``,
      includeSubtasks: `true`,
      statusesCsv: ``,
    },
    onSubmit: async (values) => {
      if (!editingWorkgraphId) {
        return;
      }

      onFeedback(null);

      const statuses = values.statusesCsv
        .split(`,`)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      const parsedSeeds = parseSeedItemsInput(values.seedItemsInput);

      if (parsedSeeds.error) {
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update assignment`,
          message: parsedSeeds.error,
        });
        return;
      }

      try {
        await updateLoopWorkgraphByAdmin(loopId, editingWorkgraphId, {
          seedItems: parsedSeeds.items,
          hierarchyRules: {
            includeSubtasks: values.includeSubtasks === `true`,
            statuses,
          },
        });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Workgraph assignment updated`,
          message: `Seeding rules have been updated.`,
        });
        reloadAssignedWorkgraphs();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update assignment`,
          message,
        });
      }
    },
  });

  const startEditing = (workgraph: LoopWorkgraph) => {
    setEditingWorkgraphId(workgraph.workgraph);

    const hierarchyRules = workgraph.hierarchyRules as { includeSubtasks?: boolean; statuses?: unknown };
    const statuses = Array.isArray(hierarchyRules.statuses) ? hierarchyRules.statuses.filter((item): item is string => typeof item === `string`) : [];

    updateFormik.setValues({
      seedItemsInput: workgraph.seedItems.join(`\n`),
      includeSubtasks: hierarchyRules.includeSubtasks === false ? `false` : `true`,
      statusesCsv: statuses.join(`, `),
    });
  };

  const handleRemoveAssignment = async (workgraph: LoopWorkgraph) => {
    setBusyWorkgraphId(workgraph.workgraph);
    onFeedback(null);

    try {
      await removeWorkgraphFromLoop(loopId, workgraph.workgraph);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Workgraph removed`,
        message: `${workgraph.name} has been removed from this loop.`,
      });
      await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
      reloadAssignedWorkgraphs();
      if (editingWorkgraphId === workgraph.workgraph) {
        setEditingWorkgraphId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove workgraph`,
        message,
      });
    } finally {
      setBusyWorkgraphId(null);
    }
  };

  return (
    <>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assign an existing workgraph</h2>
        {workgraphListState.status === `loading` ? <p className="p-text--default">Loading available workgraphs...</p> : null}
        {workgraphListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available workgraphs">
            {workgraphListState.message}
          </Notification>
        ) : null}
        {workgraphListState.status === `success` && availableWorkgraphs.length === 0 ? <p className="p-text--default">No workgraphs are available yet. Create a workgraph first, then assign it to this loop.</p> : null}
        {workgraphListState.status === `success` && availableWorkgraphs.length > 0 && unassignedWorkgraphs.length === 0 ? <p className="p-text--default">All available workgraphs are already assigned to this loop.</p> : null}
        <form onSubmit={assignFormik.handleSubmit}>
          <Select
            id="assign-workgraph-select"
            label="Workgraph"
            name="selectedWorkgraphId"
            onChange={assignFormik.handleChange}
            options={[{ value: ``, label: `- Select a workgraph -` }, ...unassignedWorkgraphs.map((workgraph) => ({ value: workgraph.id, label: workgraph.name }))]}
            value={assignFormik.values.selectedWorkgraphId}
          />
          <div className="u-align--right">
            <Button appearance="base" disabled={!assignFormik.values.selectedWorkgraphId || assignFormik.isSubmitting} type="submit">
              {assignFormik.isSubmitting ? `Assigning...` : `Assign workgraph`}
            </Button>
          </div>
        </form>
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assigned workgraphs</h2>
        {assignedWorkgraphState.status === `loading` ? <p className="p-text--default">Loading workgraphs...</p> : null}
        {assignedWorkgraphState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned workgraphs">
            {assignedWorkgraphState.message}
          </Notification>
        ) : null}
        {assignedWorkgraphState.status === `success` && assignedWorkgraphs.length === 0 ? <p className="p-text--default">No workgraphs assigned to this loop yet.</p> : null}
        {assignedWorkgraphState.status === `success` && assignedWorkgraphs.length > 0 ? (
          <MainTable
            headers={[{ content: `Name` }, { content: `Type` }, { content: `Seed items` }, { content: `Seed count` }, { content: `Sync status` }, { content: `Last synced` }, { content: `Actions` }]}
            rows={assignedWorkgraphs.map((workgraph) => ({
              key: workgraph.workgraph,
              columns: [
                { content: workgraph.name },
                { content: workgraph.type },
                { content: seedItemsPreview(workgraph.seedItems) },
                { content: String(workgraph.seedItems.length) },
                { content: statusLabels[workgraph.lastSyncStatus] ?? workgraph.lastSyncStatus },
                { content: formatTimestamp(workgraph.lastSyncedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button appearance="base" onClick={() => startEditing(workgraph)} type="button">
                        Edit seed rules
                      </Button>
                      <Button appearance="negative" disabled={busyWorkgraphId === workgraph.workgraph} onClick={() => handleRemoveAssignment(workgraph)} type="button">
                        {busyWorkgraphId === workgraph.workgraph ? `Removing ${workgraph.name}...` : `Remove ${workgraph.name}`}
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        ) : null}
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Seed and hierarchy rules</h2>
        {workgraphTypeOptionState.status === `loading` ? <p className="p-text--default">Loading workgraph options...</p> : null}
        {workgraphTypeOptionState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load workgraph options">
            {workgraphTypeOptionState.message}
          </Notification>
        ) : null}
        {!editingWorkgraphId ? <p className="p-text--default">Select an assigned workgraph and click "Edit seed rules" to configure ingestion.</p> : null}
        {editingWorkgraphId ? (
          <form onSubmit={updateFormik.handleSubmit}>
            <label htmlFor="workgraph-seed-items-input">Seed items</label>
            <textarea
              id="workgraph-seed-items-input"
              name="seedItemsInput"
              onChange={updateFormik.handleChange}
              placeholder="PROJ-123\nPROJ-456\nPROJ-789"
              rows={5}
              value={updateFormik.values.seedItemsInput}
            />
            <p className="p-text--small">Use one seed item id per line. Athena will fetch all descendants for each seed id.</p>
            <Select
              id="workgraph-include-subtasks"
              label="Include subtasks"
              name="includeSubtasks"
              onChange={updateFormik.handleChange}
              options={[
                { value: `true`, label: `Yes` },
                { value: `false`, label: `No` },
              ]}
              value={updateFormik.values.includeSubtasks}
            />
            <label htmlFor="workgraph-status-filter">Status filter CSV (optional)</label>
            <input id="workgraph-status-filter" name="statusesCsv" onChange={updateFormik.handleChange} placeholder="To Do, In Progress, Done" type="text" value={updateFormik.values.statusesCsv} />
            <div className="u-align--right">
              <Button appearance="base" onClick={() => setEditingWorkgraphId(null)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={updateFormik.isSubmitting} type="submit">
                {updateFormik.isSubmitting ? `Saving...` : `Save seed rules`}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}
