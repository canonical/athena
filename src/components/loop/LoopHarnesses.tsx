import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { assignHarnessToLoop, removeHarnessFromLoop } from "@components/harness/harness.client.js";
import { useHarnessList, useLoopHarnessList } from "@components/harness/harness.query.js";
import type { LoopHarness } from "@components/harness/harness.schema.js";
import { updateProviderSelectionPolicy } from "@components/loop/loop.client.js";
import { useProviderSelectionPolicy } from "@components/loop/loop.query.js";
import type { loopSelectionAlgorithms } from "@components/loop/loop.schema.js";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopHarnessesProps } from "./loop.schema.js";

const mvpSelectionAlgorithm = `highest-credit-absolute` as const;

const algorithmLabels: Record<(typeof loopSelectionAlgorithms)[number], string> = {
  "round-robin": `Round robin`,
  "highest-credit-percentage": `Highest credit percentage`,
  "highest-credit-absolute": `Highest absolute credit`,
  "weighted-round-robin": `Weighted round robin`,
  "least-recently-used": `Least recently used`,
  "priority-failover": `Priority failover`,
  "health-aware-cooldown": `Health-aware cooldown`,
};

const mvpAlgorithmOptions = [{ value: mvpSelectionAlgorithm, label: algorithmLabels[mvpSelectionAlgorithm] }];

const formatTimestamp = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : `-`);

export function LoopHarnesses({ loopId, onFeedback }: LoopHarnessesProps) {
  const { state: harnessListState } = useHarnessList();
  const { state: assignedHarnessState, reload: reloadAssignedHarnesses } = useLoopHarnessList(loopId);
  const { state: selectionPolicyState, reload: reloadSelectionPolicy } = useProviderSelectionPolicy(loopId);
  const [busyHarnessId, setBusyHarnessId] = useState<string | null>(null);

  const availableHarnesses = harnessListState.status === `success` ? harnessListState.harnesses : [];
  const assignedHarnesses = assignedHarnessState.status === `success` ? assignedHarnessState.harnesses : [];

  const assignedHarnessIds = new Set(assignedHarnesses.map((harness) => harness.harness));
  const unassignedHarnesses = availableHarnesses.filter((harness) => !assignedHarnessIds.has(harness.id));

  const assignFormik = useFormik<{ selectedHarnessId: string }>({
    initialValues: { selectedHarnessId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedHarnessId) {
        return;
      }

      onFeedback(null);

      try {
        await assignHarnessToLoop(loopId, values.selectedHarnessId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Harness assigned`,
          message: `Harness has been assigned to this loop.`,
        });
        helpers.resetForm();
        reloadAssignedHarnesses();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign harness`,
          message,
        });
      }
    },
  });

  const policyFormik = useFormik<{ copilotSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number] }>({
    enableReinitialize: true,
    initialValues: {
      copilotSelectionAlgorithm: mvpSelectionAlgorithm,
    },
    onSubmit: async (values, helpers) => {
      onFeedback(null);

      try {
        await updateProviderSelectionPolicy(loopId, { copilotSelectionAlgorithm: values.copilotSelectionAlgorithm });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Harness selection policy updated`,
          message: `Harness selection algorithm has been updated.`,
        });
        helpers.setSubmitting(false);
        reloadSelectionPolicy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update harness selection policy`,
          message,
        });
      }
    },
  });

  const handleRemoveAssignment = async (harness: LoopHarness) => {
    setBusyHarnessId(harness.harness);
    onFeedback(null);

    try {
      await removeHarnessFromLoop(loopId, harness.harness);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Harness removed`,
        message: `${harness.displayName} has been removed from this loop.`,
      });
      reloadAssignedHarnesses();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove harness`,
        message,
      });
    } finally {
      setBusyHarnessId(null);
    }
  };

  return (
    <>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assign an existing harness</h2>
        {harnessListState.status === `loading` ? <p className="p-text--default">Loading available harnesses...</p> : null}
        {harnessListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available harnesses">
            {harnessListState.message}
          </Notification>
        ) : null}
        {harnessListState.status === `success` && availableHarnesses.length === 0 ? <p className="p-text--default">No harnesses are available yet. Create a harness first, then assign it to this loop.</p> : null}
        {harnessListState.status === `success` && availableHarnesses.length > 0 && unassignedHarnesses.length === 0 ? <p className="p-text--default">All available harnesses are already assigned to this loop.</p> : null}
        <form onSubmit={assignFormik.handleSubmit}>
          <Select
            id="assign-harness-select"
            label="Harness"
            name="selectedHarnessId"
            onChange={assignFormik.handleChange}
            options={[{ value: ``, label: `— Select a harness —` }, ...unassignedHarnesses.map((harness) => ({ value: harness.id, label: harness.displayName }))]}
            value={assignFormik.values.selectedHarnessId}
          />
          <div className="u-align--right">
            <Button appearance="base" disabled={!assignFormik.values.selectedHarnessId || assignFormik.isSubmitting} type="submit">
              {assignFormik.isSubmitting ? `Assigning...` : `Assign harness`}
            </Button>
          </div>
        </form>
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Harness selection algorithm</h2>
        {selectionPolicyState.status === `loading` ? <p className="p-text--default">Loading harness selection policy...</p> : null}
        {selectionPolicyState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load harness selection policy">
            {selectionPolicyState.message}
          </Notification>
        ) : null}
        {selectionPolicyState.status === `success` ? (
          <form onSubmit={policyFormik.handleSubmit}>
            <Select id="loop-harness-selection-algorithm" label="Algorithm" name="copilotSelectionAlgorithm" onChange={policyFormik.handleChange} options={mvpAlgorithmOptions} value={policyFormik.values.copilotSelectionAlgorithm} />
            <div className="u-align--right">
              <Button appearance="base" disabled={policyFormik.isSubmitting} type="submit">
                {policyFormik.isSubmitting ? `Saving...` : `Save algorithm`}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assigned harnesses</h2>
        {assignedHarnessState.status === `loading` ? <p className="p-text--default">Loading harnesses...</p> : null}
        {assignedHarnessState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned harnesses">
            {assignedHarnessState.message}
          </Notification>
        ) : null}
        {assignedHarnessState.status === `success` && assignedHarnesses.length === 0 ? <p className="p-text--default">No harnesses assigned to this loop yet.</p> : null}
        {assignedHarnessState.status === `success` && assignedHarnesses.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Runner` }, { content: `Priority` }, { content: `Enabled` }, { content: `Last used` }, { content: `Actions` }]}
            rows={assignedHarnesses.map((harness) => ({
              key: harness.harness,
              columns: [
                { content: harness.displayName },
                { content: harness.runnerType },
                { content: String(harness.priority) },
                { content: harness.enabled ? `Yes` : `No` },
                { content: formatTimestamp(harness.lastUsedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button appearance="negative" disabled={busyHarnessId === harness.harness} onClick={() => handleRemoveAssignment(harness)} type="button">
                        {busyHarnessId === harness.harness ? `Removing ${harness.displayName}...` : `Remove ${harness.displayName}`}
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
