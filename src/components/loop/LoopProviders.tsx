import { Button, Icon, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { updateProviderSelectionPolicy } from "@components/loop/loop.client.js";
import { useProviderSelectionPolicy } from "@components/loop/loop.query.js";
import type { loopSelectionAlgorithms } from "@components/loop/loop.schema.js";
import { assignProviderToLoop, removeProviderFromLoop } from "@components/provider/provider.client.js";
import { useLoopProviderList, useProviderList } from "@components/provider/provider.query.js";
import type { LoopProvider } from "@components/provider/provider.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopProvidersProps } from "./loop.schema.js";

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

export function LoopProviders({ loopId, onFeedback }: LoopProvidersProps) {
  const queryClient = useQueryClient();
  const { state: providerListState } = useProviderList();
  const { state: assignedProviderState, reload: reloadAssignedProviders } = useLoopProviderList(loopId);
  const { state: providerSelectionPolicyState, reload: reloadProviderSelectionPolicy } = useProviderSelectionPolicy(loopId);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [isPolicyDrawerOpen, setIsPolicyDrawerOpen] = useState(false);

  const availableProviders = providerListState.status === `success` ? providerListState.providers.filter((provider) => provider.chat !== null) : [];
  const assignedProviders = assignedProviderState.status === `success` ? assignedProviderState.providers : [];

  const assignedProviderIds = new Set(assignedProviders.map((provider) => provider.provider));
  const unassignedProviders = availableProviders.filter((provider) => !assignedProviderIds.has(provider.id));

  const assignFormik = useFormik<{ selectedProviderId: string }>({
    initialValues: { selectedProviderId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedProviderId) {
        return;
      }

      onFeedback(null);

      try {
        await assignProviderToLoop(loopId, values.selectedProviderId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Provider assigned`,
          message: `Provider has been assigned to this loop.`,
        });
        helpers.resetForm();
        setIsAssignDrawerOpen(false);
        await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
        reloadAssignedProviders();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign provider`,
          message,
        });
      }
    },
  });

  const policyFormik = useFormik<{ providerSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number] }>({
    enableReinitialize: true,
    initialValues: {
      providerSelectionAlgorithm: providerSelectionPolicyState.status === `success` ? providerSelectionPolicyState.policy.providerSelectionAlgorithm : mvpSelectionAlgorithm,
    },
    onSubmit: async (values, helpers) => {
      onFeedback(null);

      try {
        await updateProviderSelectionPolicy(loopId, { providerSelectionAlgorithm: values.providerSelectionAlgorithm });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Provider selection policy updated`,
          message: `Provider selection algorithm has been updated.`,
        });
        helpers.setSubmitting(false);
        setIsPolicyDrawerOpen(false);
        reloadProviderSelectionPolicy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update provider selection policy`,
          message,
        });
      }
    },
  });

  const handleRemoveAssignment = async (provider: LoopProvider) => {
    setBusyProviderId(provider.provider);
    onFeedback(null);

    try {
      await removeProviderFromLoop(loopId, provider.provider);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Provider removed`,
        message: `${provider.displayName} has been removed from this loop.`,
      });
      await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
      reloadAssignedProviders();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove provider`,
        message,
      });
    } finally {
      setBusyProviderId(null);
    }
  };

  return (
    <>
      <div>
        <div className="u-clearfix">
          <div className="u-float-left">
            <h2 className="p-heading--4">Assigned providers</h2>
          </div>
          <div className="u-float-right">
            <Button appearance="positive" onClick={() => setIsPolicyDrawerOpen(true)} type="button">
              Selection algorithm
            </Button>
            <Button appearance="positive" onClick={() => setIsAssignDrawerOpen(true)} type="button">
              Assign provider
            </Button>
          </div>
        </div>
        <hr />
        {assignedProviderState.status === `loading` ? <p className="p-text--default">Loading providers...</p> : null}
        {assignedProviderState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned providers">
            {assignedProviderState.message}
          </Notification>
        ) : null}
        {assignedProviderState.status === `success` && assignedProviders.length === 0 ? <p className="p-text--default">No providers assigned to this loop yet.</p> : null}
        {assignedProviderState.status === `success` && assignedProviders.length > 0 ? (
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Display name` }, { content: `Owner` }, { content: `Type` }, { content: `Priority` }, { content: `Enabled` }, { content: `Last used` }, { content: `Actions`, className: `u-align--right` }]}
            rows={assignedProviders.map((provider) => ({
              key: provider.provider,
              columns: [
                { content: provider.displayName },
                { content: provider.owner },
                { content: provider.providerType },
                { content: String(provider.priority) },
                { content: provider.enabled ? `Yes` : `No` },
                { content: formatTimestamp(provider.lastUsedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button
                        appearance="base"
                        aria-label={`Remove ${provider.displayName}`}
                        disabled={busyProviderId === provider.provider}
                        onClick={() => handleRemoveAssignment(provider)}
                        title={`Remove ${provider.displayName}`}
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

      <EntityDrawer isOpen={isAssignDrawerOpen} onClose={() => setIsAssignDrawerOpen(false)} title="Assign provider">
        {providerListState.status === `loading` ? <p className="p-text--default">Loading available providers...</p> : null}
        {providerListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available providers">
            {providerListState.message}
          </Notification>
        ) : null}
        {providerListState.status === `success` && availableProviders.length === 0 ? <p className="p-text--default">No providers are available yet. Create a provider first, then assign it to this loop.</p> : null}
        {providerListState.status === `success` && availableProviders.length > 0 && unassignedProviders.length === 0 ? <p className="p-text--default">All available providers are already assigned to this loop.</p> : null}
        {providerListState.status === `success` && unassignedProviders.length > 0 ? (
          <form onSubmit={assignFormik.handleSubmit}>
            <Select
              id="assign-provider-select"
              label="Provider"
              name="selectedProviderId"
              onChange={assignFormik.handleChange}
              options={[{ value: ``, label: `— Select a provider —` }, ...unassignedProviders.map((provider) => ({ value: provider.id, label: provider.displayName }))]}
              value={assignFormik.values.selectedProviderId}
            />
            <div className="u-align--right">
              <Button appearance="base" onClick={() => setIsAssignDrawerOpen(false)} type="button">
                Cancel
              </Button>
              <Button appearance="positive" disabled={!assignFormik.values.selectedProviderId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign provider`}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityDrawer>

      <EntityDrawer isOpen={isPolicyDrawerOpen} onClose={() => setIsPolicyDrawerOpen(false)} title="Provider selection algorithm">
        {providerSelectionPolicyState.status === `loading` ? <p className="p-text--default">Loading provider selection policy...</p> : null}
        {providerSelectionPolicyState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load provider selection policy">
            {providerSelectionPolicyState.message}
          </Notification>
        ) : null}
        {providerSelectionPolicyState.status === `success` ? (
          <form onSubmit={policyFormik.handleSubmit}>
            <Select id="loop-provider-selection-algorithm" label="Algorithm" name="providerSelectionAlgorithm" onChange={policyFormik.handleChange} options={mvpAlgorithmOptions} value={policyFormik.values.providerSelectionAlgorithm} />
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
