import type { Provider } from "./provider.schema.js";

type ProviderDetailsProps = {
  provider: Provider;
  lifecycleLabel: Record<Provider["lifecycleStatus"], string>;
};

export function ProviderDetails({ provider, lifecycleLabel }: ProviderDetailsProps) {
  return (
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
  );
}
