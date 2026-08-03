import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useWorkgraphById } from "./workgraph.query.js";

type WorkgraphDetailProps = {
  workgraphId: string;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Workgraph({ workgraphId }: WorkgraphDetailProps) {
  const { state } = useWorkgraphById(workgraphId);

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading workgraph...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load workgraph">
        {state.message}
      </Notification>
    );
  }

  const workgraph = state.workgraph;

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{workgraph.name}</h1>
      <div className="p-card p-strip is-shallow">
        <div className="p-list__item">
          <strong>Type:</strong> {workgraph.type}
        </div>
        <div className="p-list__item">
          <strong>Base URL:</strong> {workgraph.baseUrl}
        </div>
        <div className="p-list__item">
          <strong>Project key:</strong> {workgraph.projectKey || `-`}
        </div>
        <div className="p-list__item">
          <strong>Status:</strong> {lifecycleLabel[workgraph.lifecycleStatus] ?? workgraph.lifecycleStatus}
        </div>
        <div className="p-list__item">
          <strong>Updated:</strong> {new Date(workgraph.updatedAt).toLocaleString()}
        </div>
      </div>
    </section>
  );
}
