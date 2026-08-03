import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoopEditor } from "./LoopEditor.js";
import { deleteLoop } from "./loop.client.js";
import { useLoopList } from "./loop.query.js";
import type { Feedback, Loop } from "./loop.schema.js";

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

type LoopListProps = {
  editor?: `create` | `edit`;
  loopId?: string;
};

export function LoopList({ editor, loopId }: LoopListProps) {
  const navigate = useNavigate();
  const { state, reload } = useLoopList();
  const [busyLoopId, setBusyLoopId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: `/loop/list`, search: { create: true, edit: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (loop: Loop) => {
    void navigate({ to: `/loop/list`, search: { create: undefined, edit: loop.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/loop/list`, search: { create: undefined, edit: undefined } });
  };

  const selectedLoop = state.status === `success` && loopId ? state.loops.find((loop) => loop.id === loopId) : undefined;

  const handleDelete = async (loop: Loop) => {
    const confirmed = window.confirm(`Delete loop "${loop.name}"?`);

    if (!confirmed) {
      return;
    }

    setBusyLoopId(loop.id);
    setFeedback(null);

    try {
      await deleteLoop(loop.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop deleted`,
        message: `${loop.name} has been deleted.`,
      });

      if (editor === `edit` && loopId === loop.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete loop`,
        message,
      });
    } finally {
      setBusyLoopId(null);
    }
  };

  return (
    <section className="u-no-max-width">
      {state.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create
              </Button>
            </div>
          </div>
        </div>
        {state.status === `success` && state.loops.length > 0 ? (
          <MainTable
            headers={[{ content: "Actions" }, { content: "Name" }, { content: "Description" }, { content: "Updated at" }]}
            rows={state.loops.map((loop) => ({
              key: loop.id,
              columns: [
                {
                  content: (
                    <div>
                      <Button appearance="base" aria-label="Edit" hasIcon={true} onClick={() => openEditDrawer(loop)} title="Edit" type="button">
                        <i className="p-icon--edit" />
                        <span className="u-off-screen">Edit</span>
                      </Button>
                      <Button
                        appearance="negative"
                        aria-label={busyLoopId === loop.id ? `Deleting` : `Delete`}
                        disabled={busyLoopId === loop.id}
                        hasIcon={true}
                        onClick={() => handleDelete(loop)}
                        title={busyLoopId === loop.id ? `Deleting` : `Delete`}
                        type="button"
                      >
                        <i className="p-icon--delete" />
                        <span className="u-off-screen">{busyLoopId === loop.id ? `Deleting` : `Delete`}</span>
                      </Button>
                    </div>
                  ),
                },
                {
                  content: (
                    <Link params={{ loopId: loop.id }} to={`/loop/$loopId`}>
                      {loop.name}
                    </Link>
                  ),
                },
                { content: loop.description ?? "-" },
                { content: formatTimestamp(loop.updatedAt) },
              ],
            }))}
          />
        ) : state.status === `success` ? (
          <p className="p-text--default">No loops yet.</p>
        ) : null}
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit loop` : `Create loop`}>
        {editor === `edit` && !selectedLoop ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Loop not found">
            The selected loop no longer exists.
          </Notification>
        ) : (
          <LoopEditor
            loop={editor === `edit` ? selectedLoop : undefined}
            onSuccess={(nextFeedback) => {
              setFeedback(nextFeedback);
              closeDrawer();
              reload();
            }}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
