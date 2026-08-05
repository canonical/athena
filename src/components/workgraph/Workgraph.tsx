import { Button, Notification, NotificationSeverity, useToastNotification } from "@canonical/react-components";
import { useState } from "react";
import { testWorkgraphConnectionById } from "./workgraph.client.js";
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
  const toastNotify = useToastNotification();
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);

    try {
      const result = await testWorkgraphConnectionById(workgraphId);
      toastNotify.info(result.message, `Connection test passed`);
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : String(testError);
      toastNotify.failure(`Workgraph connection test failed`, testError instanceof Error ? testError : new Error(message));
    } finally {
      setIsTesting(false);
    }
  };

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
      <div className="u-align--right">
        <Button appearance="base" disabled={isTesting} onClick={() => void handleTestConnection()} type="button">
          {isTesting ? `Testing...` : `Test`}
        </Button>
      </div>
      <div className="p-card p-strip is-shallow">
        <div className="p-list__item">
          <strong>Type:</strong> {workgraph.type}
        </div>
        <div className="p-list__item">
          <strong>Base URL:</strong> {workgraph.baseUrl}
        </div>
        <div className="p-list__item">
          <strong>Browse base URL:</strong> {workgraph.browseBaseUrl || workgraph.baseUrl}
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
