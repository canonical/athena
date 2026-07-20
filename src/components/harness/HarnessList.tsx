import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HarnessEditor } from "./HarnessEditor.js";
import { deleteHarness } from "./harness.client.js";
import { useHarnessList } from "./harness.query.js";
import type { Harness } from "./harness.schema.js";

type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

const lifecycleLabel: Record<Harness["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type HarnessListProps = {
  editor?: `create` | `edit`;
  harnessId?: string;
};

export function HarnessList({ editor, harnessId }: HarnessListProps) {
  const navigate = useNavigate();
  const { state, reload } = useHarnessList();
  const [busyHarnessId, setBusyHarnessId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const openCreateDrawer = () => {
    void navigate({ to: `/harness/list`, search: { create: true, edit: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (harness: Harness) => {
    void navigate({ to: `/harness/list`, search: { create: undefined, edit: harness.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/harness/list`, search: { create: undefined, edit: undefined } });
  };

  const harnesses = state.status === `success` ? state.harnesses : [];
  const selectedHarness = state.status === `success` && harnessId ? state.harnesses.find((harness) => harness.id === harnessId) : undefined;

  const handleDelete = async (harness: Harness) => {
    setBusyHarnessId(harness.id);
    setFeedback(null);

    try {
      await deleteHarness(harness.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Harness deleted`,
        message: `${harness.displayName} has been deleted.`,
      });

      if (editor === `edit` && harnessId === harness.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete harness`,
        message,
      });
    } finally {
      setBusyHarnessId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Harnesses</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      {state.status === `loading` ? <p className="p-text--default">Loading harnesses...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load harnesses">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create harness
              </Button>
            </div>
          </div>
        </div>
        <MainTable
          emptyStateMsg="No harnesses yet."
          headers={[{ content: `Display name` }, { content: `Runner` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions` }]}
          rows={harnesses.map((harness: Harness) => ({
            key: harness.id,
            columns: [
              { content: harness.displayName },
              { content: harness.runnerType },
              { content: lifecycleLabel[harness.lifecycleStatus] ?? harness.lifecycleStatus },
              { content: formatTimestamp(harness.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" onClick={() => openEditDrawer(harness)} type="button">
                      {`Edit ${harness.displayName}`}
                    </Button>
                    <Button appearance="negative" disabled={busyHarnessId === harness.id} onClick={() => handleDelete(harness)} type="button">
                      {busyHarnessId === harness.id ? `Deleting ${harness.displayName}...` : `Delete ${harness.displayName}`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit harness` : `Create harness`}>
        {editor === `edit` && !selectedHarness ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Harness not found">
            The selected harness no longer exists.
          </Notification>
        ) : (
          <HarnessEditor
            harness={editor === `edit` ? selectedHarness : undefined}
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
