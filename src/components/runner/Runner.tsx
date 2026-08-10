import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useRunnerById } from "./runner.query.js";

type RunnerDetailProps = {
  runnerId: string;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Runner({ runnerId }: RunnerDetailProps) {
  const { state } = useRunnerById(runnerId);

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading runner...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load runner">
        {state.message}
      </Notification>
    );
  }

  const runner = state.runner;

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{runner.displayName}</h1>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Runner details</h2>
        <dl>
          <dt>Runner</dt>
          <dd>{runner.runnerType}</dd>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleLabel[runner.lifecycleStatus] ?? runner.lifecycleStatus}</dd>
          <dt>Credential configured</dt>
          <dd>{runner.hasCredential ? `Yes` : `No`}</dd>
        </dl>
      </div>
    </section>
  );
}
