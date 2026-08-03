import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RunnerEditor } from "./RunnerEditor.js";
import { deleteRunner } from "./runner.client.js";
import { useRunnerList } from "./runner.query.js";
import type { Runner } from "./runner.schema.js";

type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

const lifecycleLabel: Record<Runner["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type RunnerListProps = {
  editor?: `create` | `edit`;
  runnerId?: string;
};

export function RunnerList({ editor, runnerId }: RunnerListProps) {
  const navigate = useNavigate();
  const { state, reload } = useRunnerList();
  const [busyRunnerId, setBusyRunnerId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: `/runner/list`, search: { create: true, edit: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (runner: Runner) => {
    void navigate({ to: `/runner/list`, search: { create: undefined, edit: runner.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/runner/list`, search: { create: undefined, edit: undefined } });
  };

  const runners = state.status === `success` ? state.runners : [];
  const selectedRunner = state.status === `success` && runnerId ? state.runners.find((runner) => runner.id === runnerId) : undefined;

  const handleDelete = async (runner: Runner) => {
    setBusyRunnerId(runner.id);
    setFeedback(null);

    try {
      await deleteRunner(runner.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Runner deleted`,
        message: `${runner.displayName} has been deleted.`,
      });

      if (editor === `edit` && runnerId === runner.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete runner`,
        message,
      });
    } finally {
      setBusyRunnerId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Runners</h1>
      {state.status === `loading` ? <p className="p-text--default">Loading runners...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load runners">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create runner
              </Button>
            </div>
          </div>
        </div>
        <MainTable
          emptyStateMsg="No runners yet."
          headers={[{ content: `Display name` }, { content: `Runner` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions` }]}
          rows={runners.map((runner: Runner) => ({
            key: runner.id,
            columns: [
              { content: runner.displayName },
              { content: runner.runnerType },
              { content: lifecycleLabel[runner.lifecycleStatus] ?? runner.lifecycleStatus },
              { content: formatTimestamp(runner.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" onClick={() => openEditDrawer(runner)} type="button">
                      {`Edit ${runner.displayName}`}
                    </Button>
                    <Button appearance="negative" disabled={busyRunnerId === runner.id} onClick={() => handleDelete(runner)} type="button">
                      {busyRunnerId === runner.id ? `Deleting ${runner.displayName}...` : `Delete ${runner.displayName}`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit runner` : `Create runner`}>
        {editor === `edit` && !selectedRunner ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Runner not found">
            The selected runner no longer exists.
          </Notification>
        ) : (
          <RunnerEditor
            runner={editor === `edit` ? selectedRunner : undefined}
            onSuccess={(title, message) => {
              setFeedback({ severity: NotificationSeverity.INFORMATION, title, message });
              closeDrawer();
              reload();
            }}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
