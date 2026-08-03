import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { WorkgraphEditor } from "./WorkgraphEditor.js";
import { deleteWorkgraph } from "./workgraph.client.js";
import { useWorkgraphList, useWorkgraphTypeOptions } from "./workgraph.query.js";
import type { Workgraph } from "./workgraph.schema.js";

type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

const lifecycleLabel: Record<Workgraph["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type WorkgraphListProps = {
  editor?: `create` | `edit`;
  workgraphId?: string;
  listRoute?: `/workgraph/list` | `/connection`;
};

export function WorkgraphList({ editor, workgraphId, listRoute = `/workgraph/list` }: WorkgraphListProps) {
  const navigate = useNavigate();
  const { state, reload } = useWorkgraphList();
  const { state: workgraphTypeOptionState } = useWorkgraphTypeOptions();
  const [busyWorkgraphId, setBusyWorkgraphId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: listRoute, search: { create: true, edit: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (workgraph: Workgraph) => {
    void navigate({ to: listRoute, search: { create: undefined, edit: workgraph.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: listRoute, search: { create: undefined, edit: undefined } });
  };

  const workgraphs = state.status === `success` ? state.workgraphs : [];
  const selectedWorkgraph = state.status === `success` && workgraphId ? state.workgraphs.find((workgraph) => workgraph.id === workgraphId) : undefined;

  const handleDelete = async (workgraph: Workgraph) => {
    setBusyWorkgraphId(workgraph.id);
    setFeedback(null);

    try {
      await deleteWorkgraph(workgraph.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Workgraph deleted`,
        message: `${workgraph.name} has been deleted.`,
      });

      if (editor === `edit` && workgraphId === workgraph.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete workgraph`,
        message,
      });
    } finally {
      setBusyWorkgraphId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Workgraphs</h1>
      {state.status === `loading` ? <p className="p-text--default">Loading workgraphs...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load workgraphs">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create workgraph
              </Button>
            </div>
          </div>
        </div>
        <MainTable
          emptyStateMsg="No workgraphs yet."
          headers={[{ content: `Name` }, { content: `Type` }, { content: `Project key` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions` }]}
          rows={workgraphs.map((workgraph: Workgraph) => ({
            key: workgraph.id,
            columns: [
              {
                content: (
                  <Link params={{ workgraphId: workgraph.id }} to={`/workgraph/$workgraphId`}>
                    {workgraph.name}
                  </Link>
                ),
              },
              { content: workgraph.type },
              { content: workgraph.projectKey || `-` },
              { content: lifecycleLabel[workgraph.lifecycleStatus] ?? workgraph.lifecycleStatus },
              { content: formatTimestamp(workgraph.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" onClick={() => openEditDrawer(workgraph)} type="button">
                      {`Edit definition`}
                    </Button>
                    <Button appearance="negative" disabled={busyWorkgraphId === workgraph.id} onClick={() => handleDelete(workgraph)} type="button">
                      {busyWorkgraphId === workgraph.id ? `Deleting ${workgraph.name}...` : `Delete ${workgraph.name}`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit workgraph` : `Create workgraph`}>
        {workgraphTypeOptionState.status === `loading` ? <p className="p-text--default">Loading workgraph types...</p> : null}
        {workgraphTypeOptionState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load workgraph types">
            {workgraphTypeOptionState.message}
          </Notification>
        ) : null}
        {workgraphTypeOptionState.status === `success` && editor === `edit` && !selectedWorkgraph ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Workgraph not found">
            The selected workgraph no longer exists.
          </Notification>
        ) : null}
        {workgraphTypeOptionState.status === `success` && (editor !== `edit` || selectedWorkgraph) ? (
          <WorkgraphEditor
            isDeleting={Boolean(editor === `edit` && selectedWorkgraph && busyWorkgraphId === selectedWorkgraph.id)}
            onDelete={editor === `edit` && selectedWorkgraph ? handleDelete : undefined}
            onSuccess={(title, message) => {
              setFeedback({ severity: NotificationSeverity.INFORMATION, title, message });
              closeDrawer();
              reload();
            }}
            typeOptions={workgraphTypeOptionState.options}
            workgraph={editor === `edit` ? selectedWorkgraph : undefined}
          />
        ) : null}
      </EntityDrawer>
    </section>
  );
}
