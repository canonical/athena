import { Notification, NotificationSeverity } from "@canonical/react-components";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useProviderById } from "./provider.query.js";
import type { Provider as ProviderEntity } from "./provider.schema.js";

type ProviderDetailProps = {
  providerId: string;
  tab?: `details` | `settings`;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Provider({ providerId, tab = `details` }: ProviderDetailProps) {
  const { state, reload } = useProviderById(providerId);

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

  return <ProviderDetailContent provider={state.provider} reload={reload} selectedTab={tab} />;
}

const LazyProviderDetails = lazy(async () => {
  const module = await import("./ProviderDetails.js");

  return { default: module.ProviderDetails };
});

const LazyProviderSettings = lazy(async () => {
  const module = await import("./ProviderSettings.js");

  return { default: module.ProviderSettings };
});

type ProviderDetailContentProps = {
  provider: ProviderEntity;
  reload: () => void;
  selectedTab: `details` | `settings`;
};

function ProviderDetailContent({ provider, reload, selectedTab }: ProviderDetailContentProps) {
  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{provider.displayName}</h1>
      <nav className="p-tabs">
        <ul className="p-tabs__list">
          <li className="p-tabs__item">
            <Link className={`p-tabs__link${selectedTab === `details` ? ` is-active` : ``}`} params={{ providerId: provider.id }} to="/provider/$providerId">
              Details
            </Link>
          </li>
          <li className="p-tabs__item">
            <Link className={`p-tabs__link${selectedTab === `settings` ? ` is-active` : ``}`} params={{ providerId: provider.id }} to="/provider/$providerId/settings">
              Settings
            </Link>
          </li>
        </ul>
      </nav>
      <Suspense
        fallback={
          <section className="p-strip is-shallow u-no-max-width">
            <p className="p-text--default">Loading tab...</p>
          </section>
        }
      >
        {selectedTab === `details` ? <LazyProviderDetails provider={provider} lifecycleLabel={lifecycleLabel} /> : <LazyProviderSettings provider={provider} reload={reload} />}
      </Suspense>
    </section>
  );
}
