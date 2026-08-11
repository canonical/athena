import { Button, Icon, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { updateProviderSelectionPolicy } from "@components/loop/loop.client.js";
import { useProviderSelectionPolicy } from "@components/loop/loop.query.js";
import type { loopSelectionAlgorithms } from "@components/loop/loop.schema.js";
import { assignRunnerToLoop, removeRunnerFromLoop } from "@components/runner/runner.client.js";
import { useLoopRunnerList, useRunnerList } from "@components/runner/runner.query.js";
import type { LoopRunner } from "@components/runner/runner.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopRunnersProps } from "./loop.schema.js";

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

export function LoopRunners({ loopId, onFeedback }: LoopRunnersProps) {
  const queryClient = useQueryClient();
  const { state: runnerListState } = useRunnerList();
  const { state: assignedRunnerState, reload: reloadAssignedRunners } = useLoopRunnerList(loopId);
  const { state: selectionPolicyState, reload: reloadSelectionPolicy } = useProviderSelectionPolicy(loopId);
  const [busyRunnerId, setBusyRunnerId] = useState<string | null>(null);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [isPolicyDrawerOpen, setIsPolicyDrawerOpen] = useState(false);

  const availableRunners = runnerListState.status === `success` ? runnerListState.runners : [];
  const assignedRunners = assignedRunnerState.status === `success` ? assignedRunnerState.runners : [];

  const assignedRunnerIds = new Set(assignedRunners.map((runner) => runner.runner));
  const unassignedRunners = availableRunners.filter((runner) => !assignedRunnerIds.has(runner.id));

  const assignFormik = useFormik<{ selectedRunnerId: string }>({
    initialValues: { selectedRunnerId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedRunnerId) {
        return;
      }

      onFeedback(null);

      try {
        await assignRunnerToLoop(loopId, values.selectedRunnerId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Runner assigned`,
          message: `Runner has been assigned to this loop.`,
        });
        helpers.resetForm();
        setIsAssignDrawerOpen(false);
        await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
        reloadAssignedRunners();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign runner`,
          message,
        });
      }
    },
  });

  const policyFormik = useFormik<{ runnerSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number] }>({
    enableReinitialize: true,
    initialValues: {
      runnerSelectionAlgorithm: selectionPolicyState.status === `success` ? selectionPolicyState.policy.runnerSelectionAlgorithm : mvpSelectionAlgorithm,
    },
    onSubmit: async (values, helpers) => {
      onFeedback(null);

      try {
        await updateProviderSelectionPolicy(loopId, { runnerSelectionAlgorithm: values.runnerSelectionAlgorithm });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Runner selection policy updated`,
          message: `Runner selection algorithm has been updated.`,
        });
        helpers.setSubmitting(false);
        setIsPolicyDrawerOpen(false);
        reloadSelectionPolicy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update runner selection policy`,
          message,
        });
      }
    },
  });

  const handleRemoveAssignment = async (runner: LoopRunner) => {
    setBusyRunnerId(runner.runner);
    onFeedback(null);

    try {
      await removeRunnerFromLoop(loopId, runner.runner);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Runner removed`,
        message: `${runner.displayName} has been removed from this loop.`,
      });
      await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
      reloadAssignedRunners();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove runner`,
        message,
      });
    } finally {
      setBusyRunnerId(null);
    }
  };

  return (
    <>
      <div>
        <div className="u-clearfix">
          <div className="u-float-left">
            <h2 className="p-heading--4">Assigned runners</h2>
          </div>
          <div className="u-float-right">
            <Button appearance="positive" onClick={() => setIsPolicyDrawerOpen(true)} type="button">
              Selection algorithm
            </Button>
            <Button appearance="positive" onClick={() => setIsAssignDrawerOpen(true)} type="button">
              Assign runner
            </Button>
          </div>
        </div>
        <hr />
        {assignedRunnerState.status === `loading` ? <p className="p-text--default">Loading runners...</p> : null}
        {assignedRunnerState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned runners">
            {assignedRunnerState.message}
          </Notification>
        ) : null}
        {assignedRunnerState.status === `success` && assignedRunners.length === 0 ? <p className="p-text--default">No runners assigned to this loop yet.</p> : null}
        {assignedRunnerState.status === `success` && assignedRunners.length > 0 ? (
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Display name` }, { content: `Runner` }, { content: `Priority` }, { content: `Enabled` }, { content: `Last used` }, { content: `Actions`, className: `u-align--right` }]}
            rows={assignedRunners.map((runner) => ({
              key: runner.runner,
              columns: [
                { content: <a href={`/loop/${loopId}/runners/${runner.runner}`}>{runner.displayName}</a> },
                { content: runner.runnerType },
                { content: String(runner.priority) },
                { content: runner.enabled ? `Yes` : `No` },
                { content: formatTimestamp(runner.lastUsedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button appearance="base" aria-label={`Remove ${runner.displayName}`} disabled={busyRunnerId === runner.runner} onClick={() => handleRemoveAssignment(runner)} title={`Remove ${runner.displayName}`} type="button">
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

      <EntityDrawer isOpen={isAssignDrawerOpen} onClose={() => setIsAssignDrawerOpen(false)} title="Assign runner">
        {runnerListState.status === `loading` ? <p className="p-text--default">Loading available runners...</p> : null}
        {runnerListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available runners">
            {runnerListState.message}
          </Notification>
        ) : null}
        {runnerListState.status === `success` && availableRunners.length === 0 ? <p className="p-text--default">No runners are available yet. Create a runner first, then assign it to this loop.</p> : null}
        {runnerListState.status === `success` && availableRunners.length > 0 && unassignedRunners.length === 0 ? <p className="p-text--default">All available runners are already assigned to this loop.</p> : null}
        {runnerListState.status === `success` && unassignedRunners.length > 0 ? (
          <form onSubmit={assignFormik.handleSubmit}>
            <Select
              id="assign-runner-select"
              label="Runner"
              name="selectedRunnerId"
              onChange={assignFormik.handleChange}
              options={[{ value: ``, label: `— Select a runner —` }, ...unassignedRunners.map((runner) => ({ value: runner.id, label: runner.displayName }))]}
              value={assignFormik.values.selectedRunnerId}
            />
            <div className="u-align--right">
              <Button appearance="base" onClick={() => setIsAssignDrawerOpen(false)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={!assignFormik.values.selectedRunnerId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign runner`}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityDrawer>

      <EntityDrawer isOpen={isPolicyDrawerOpen} onClose={() => setIsPolicyDrawerOpen(false)} title="Runner selection algorithm">
        {selectionPolicyState.status === `loading` ? <p className="p-text--default">Loading runner selection policy...</p> : null}
        {selectionPolicyState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load runner selection policy">
            {selectionPolicyState.message}
          </Notification>
        ) : null}
        {selectionPolicyState.status === `success` ? (
          <form onSubmit={policyFormik.handleSubmit}>
            <Select id="loop-runner-selection-algorithm" label="Algorithm" name="runnerSelectionAlgorithm" onChange={policyFormik.handleChange} options={mvpAlgorithmOptions} value={policyFormik.values.runnerSelectionAlgorithm} />
            <div className="u-align--right">
              <Button appearance="base" onClick={() => setIsPolicyDrawerOpen(false)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={policyFormik.isSubmitting} type="submit">
                {policyFormik.isSubmitting ? `Saving...` : `Save algorithm`}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityDrawer>
    </>
  );
}
