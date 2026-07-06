import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useProviderById } from "./provider.query.js";

type ProviderDetailProps = {
  providerId: string;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Provider({ providerId }: ProviderDetailProps) {
  const { state } = useProviderById(providerId);

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading provider...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load provider">
        {state.message}
      </Notification>
    );
  }

  const provider = state.provider;

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{provider.displayName}</h1>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Provider details</h2>
        <dl>
          <dt>Type</dt>
          <dd>{provider.providerType}</dd>
          <dt>Base URL</dt>
          <dd>{provider.baseUrl}</dd>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleLabel[provider.lifecycleStatus] ?? provider.lifecycleStatus}</dd>
          <dt>Credential configured</dt>
          <dd>{provider.hasCredential ? `Yes` : `No`}</dd>
        </dl>
      </div>
    </section>
  );
}
