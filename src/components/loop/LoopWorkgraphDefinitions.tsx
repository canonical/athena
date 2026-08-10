import { Button, Icon, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import type { LoopWorkgraphListState, WorkgraphListState } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, Workgraph } from "@components/workgraph/workgraph.schema.js";
import type { FormikProps } from "formik";
import { useState } from "react";

type AssignWorkgraphFormValues = {
  selectedWorkgraphId: string;
};

type LoopWorkgraphDefinitionsProps = {
  workgraphListState: WorkgraphListState;
  assignedWorkgraphState: LoopWorkgraphListState;
  availableWorkgraphs: Workgraph[];
  unassignedWorkgraphs: Workgraph[];
  assignedWorkgraphs: LoopWorkgraph[];
  assignFormik: FormikProps<AssignWorkgraphFormValues>;
  onOpenWorkgraphSubtab: (workgraphId: string) => void;
  onRemoveAssignment: (workgraph: LoopWorkgraph) => Promise<void>;
  busyWorkgraphId: string | null;
  formatTimestamp: (value: Date | string | null) => string;
  jqlPreview: (jql: string) => string;
  statusLabels: Record<`never` | `synchronizing` | `synchronized` | `failed`, string>;
};

const getAssignmentJql = (workgraph: LoopWorkgraph): string => {
  const assignmentConfig = workgraph.assignmentConfig;

  if (!assignmentConfig || typeof assignmentConfig !== `object` || Array.isArray(assignmentConfig)) {
    return ``;
  }

  const jql = (assignmentConfig as Record<string, unknown>).jql;
  return typeof jql === `string` ? jql : ``;
};

export function LoopWorkgraphDefinitions({
  workgraphListState,
  assignedWorkgraphState,
  availableWorkgraphs,
  unassignedWorkgraphs,
  assignedWorkgraphs,
  assignFormik,
  onOpenWorkgraphSubtab,
  onRemoveAssignment,
  busyWorkgraphId,
  formatTimestamp,
  jqlPreview,
  statusLabels,
}: LoopWorkgraphDefinitionsProps) {
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);

  return (
    <>
      <div>
        <div className="u-clearfix">
          <div className="u-float-left">
            <h2 className="p-heading--4">Assigned workgraphs</h2>
          </div>
          <div className="u-float-right">
            <Button appearance="positive" onClick={() => setIsAssignDrawerOpen(true)} type="button">
              Assign workgraph
            </Button>
          </div>
        </div>
        <hr />
        {assignedWorkgraphState.status === `loading` ? <p className="p-text--default">Loading workgraphs...</p> : null}
        {assignedWorkgraphState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned workgraphs">
            {assignedWorkgraphState.message}
          </Notification>
        ) : null}
        {assignedWorkgraphState.status === `success` && assignedWorkgraphs.length === 0 ? <p className="p-text--default">No workgraphs assigned to this loop yet.</p> : null}
        {assignedWorkgraphState.status === `success` && assignedWorkgraphs.length > 0 ? (
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Name` }, { content: `Type` }, { content: `JQL` }, { content: `Sync status` }, { content: `Last synced` }, { content: `Actions`, className: `u-align--right` }]}
            rows={assignedWorkgraphs.map((workgraph) => ({
              key: workgraph.workgraph,
              columns: [
                {
                  content: (
                    <Button appearance="link" onClick={() => onOpenWorkgraphSubtab(workgraph.workgraph)} type="button">
                      {workgraph.name}
                    </Button>
                  ),
                },
                { content: workgraph.type },
                { content: jqlPreview(getAssignmentJql(workgraph)) },
                { content: statusLabels[workgraph.lastSyncStatus] ?? workgraph.lastSyncStatus },
                { content: formatTimestamp(workgraph.lastSyncedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button
                        appearance="base"
                        aria-label={`Unassign ${workgraph.name}`}
                        disabled={busyWorkgraphId === workgraph.workgraph}
                        onClick={() => void onRemoveAssignment(workgraph)}
                        title={`Unassign ${workgraph.name}`}
                        type="button"
                      >
                        <Icon aria-hidden="true" className="text-negative" name="delete" />
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        ) : null}
      </div>

      <EntityDrawer isOpen={isAssignDrawerOpen} onClose={() => setIsAssignDrawerOpen(false)} title="Assign workgraph">
        {workgraphListState.status === `loading` ? <p className="p-text--default">Loading available workgraphs...</p> : null}
        {workgraphListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available workgraphs">
            {workgraphListState.message}
          </Notification>
        ) : null}
        {workgraphListState.status === `success` && availableWorkgraphs.length === 0 ? <p className="p-text--default">No workgraphs are available yet. Create a workgraph first, then assign it to this loop.</p> : null}
        {workgraphListState.status === `success` && availableWorkgraphs.length > 0 && unassignedWorkgraphs.length === 0 ? <p className="p-text--default">All available workgraphs are already assigned to this loop.</p> : null}
        {workgraphListState.status === `success` && unassignedWorkgraphs.length > 0 ? (
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
              <Button appearance="base" onClick={() => setIsAssignDrawerOpen(false)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={!assignFormik.values.selectedWorkgraphId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign workgraph`}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityDrawer>
    </>
  );
}
