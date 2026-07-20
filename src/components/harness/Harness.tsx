import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useHarnessById } from "./harness.query.js";

type HarnessDetailProps = {
  harnessId: string;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Harness({ harnessId }: HarnessDetailProps) {
  const { state } = useHarnessById(harnessId);

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading harness...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load harness">
        {state.message}
      </Notification>
    );
  }

  const harness = state.harness;

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{harness.displayName}</h1>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Harness details</h2>
        <dl>
          <dt>Runner</dt>
          <dd>{harness.runnerType}</dd>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleLabel[harness.lifecycleStatus] ?? harness.lifecycleStatus}</dd>
          <dt>Credential configured</dt>
          <dd>{harness.hasCredential ? `Yes` : `No`}</dd>
        </dl>
      </div>
    </section>
  );
}
