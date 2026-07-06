import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { updateProviderSelectionPolicy } from "@components/loop/loop.client.js";
import { useProviderSelectionPolicy } from "@components/loop/loop.query.js";
import { loopSelectionAlgorithms } from "@components/loop/loop.schema.js";
import { assignProviderToLoop, removeProviderFromLoop } from "@components/provider/provider.client.js";
import { useLoopProviderList, useProviderList } from "@components/provider/provider.query.js";
import type { LoopProvider } from "@components/provider/provider.schema.js";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopProvidersProps } from "./loop.schema.js";

const algorithmLabels: Record<(typeof loopSelectionAlgorithms)[number], string> = {
  "round-robin": `Round robin`,
  "highest-credit-percentage": `Highest credit percentage`,
  "highest-credit-absolute": `Highest absolute credit`,
  "weighted-round-robin": `Weighted round robin`,
  "least-recently-used": `Least recently used`,
  "priority-failover": `Priority failover`,
  "health-aware-cooldown": `Health-aware cooldown`,
};

const formatTimestamp = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : `-`);

export function LoopProviders({ loopId, onFeedback }: LoopProvidersProps) {
  const { state: providerListState } = useProviderList();
  const { state: assignedProviderState, reload: reloadAssignedProviders } = useLoopProviderList(loopId);
  const { state: providerSelectionPolicyState, reload: reloadProviderSelectionPolicy } = useProviderSelectionPolicy(loopId);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const availableProviders = providerListState.status === `success` ? providerListState.providers : [];
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

  const policyFormik = useFormik<{ openRouterSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number] }>({
    enableReinitialize: true,
    initialValues: {
      openRouterSelectionAlgorithm: providerSelectionPolicyState.status === `success` ? providerSelectionPolicyState.policy.openRouterSelectionAlgorithm : `round-robin`,
    },
    onSubmit: async (values, helpers) => {
      onFeedback(null);

      try {
        await updateProviderSelectionPolicy(loopId, { openRouterSelectionAlgorithm: values.openRouterSelectionAlgorithm });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Provider selection policy updated`,
          message: `Provider selection algorithm has been updated.`,
        });
        helpers.setSubmitting(false);
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
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assign an existing provider</h2>
        {providerListState.status === `loading` ? <p className="p-text--default">Loading available providers...</p> : null}
        {providerListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available providers">
            {providerListState.message}
          </Notification>
        ) : null}
        {providerListState.status === `success` && availableProviders.length === 0 ? <p className="p-text--default">No providers are available yet. Create a provider first, then assign it to this loop.</p> : null}
        {providerListState.status === `success` && availableProviders.length > 0 && unassignedProviders.length === 0 ? <p className="p-text--default">All available providers are already assigned to this loop.</p> : null}
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
            <Button appearance="base" disabled={!assignFormik.values.selectedProviderId || assignFormik.isSubmitting} type="submit">
              {assignFormik.isSubmitting ? `Assigning...` : `Assign provider`}
            </Button>
          </div>
        </form>
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Provider selection algorithm</h2>
        {providerSelectionPolicyState.status === `loading` ? <p className="p-text--default">Loading provider selection policy...</p> : null}
        {providerSelectionPolicyState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load provider selection policy">
            {providerSelectionPolicyState.message}
          </Notification>
        ) : null}
        {providerSelectionPolicyState.status === `success` ? (
          <form onSubmit={policyFormik.handleSubmit}>
            <Select
              id="loop-provider-selection-algorithm"
              label="Algorithm"
              name="openRouterSelectionAlgorithm"
              onChange={policyFormik.handleChange}
              options={loopSelectionAlgorithms.map((algorithm) => ({ value: algorithm, label: algorithmLabels[algorithm] }))}
              value={policyFormik.values.openRouterSelectionAlgorithm}
            />
            <div className="u-align--right">
              <Button appearance="base" disabled={policyFormik.isSubmitting} type="submit">
                {policyFormik.isSubmitting ? `Saving...` : `Save algorithm`}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assigned providers</h2>
        {assignedProviderState.status === `loading` ? <p className="p-text--default">Loading providers...</p> : null}
        {assignedProviderState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned providers">
            {assignedProviderState.message}
          </Notification>
        ) : null}
        {assignedProviderState.status === `success` && assignedProviders.length === 0 ? <p className="p-text--default">No providers assigned to this loop yet.</p> : null}
        {assignedProviderState.status === `success` && assignedProviders.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Owner` }, { content: `Type` }, { content: `Priority` }, { content: `Enabled` }, { content: `Last used` }, { content: `Actions` }]}
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
                      <Button appearance="negative" disabled={busyProviderId === provider.provider} onClick={() => handleRemoveAssignment(provider)} type="button">
                        {busyProviderId === provider.provider ? `Removing ${provider.displayName}...` : `Remove ${provider.displayName}`}
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
