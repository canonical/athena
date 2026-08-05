import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import type { LoopWorkgraphListState, WorkgraphListState } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, Workgraph } from "@components/workgraph/workgraph.schema.js";
import type { FormikProps } from "formik";

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
            headers={[{ content: `Name` }, { content: `Type` }, { content: `JQL` }, { content: `Sync status` }, { content: `Last synced` }, { content: `Actions` }]}
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
                      <Button appearance="negative" disabled={busyWorkgraphId === workgraph.workgraph} onClick={() => void onRemoveAssignment(workgraph)} type="button">
                        {busyWorkgraphId === workgraph.workgraph ? `Unassigning ${workgraph.name}...` : `Unassign ${workgraph.name}`}
                      </Button>
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
