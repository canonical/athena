import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { type FormEvent, useState } from "react";
import { createLoop, deleteLoop, updateLoop } from "./loop.client.js";
import { useLoops } from "./loop.query.js";
import type { Loop as LoopRecord } from "./loop.schema.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

export function Loop() {
  const { state, reload } = useLoops();
  const [createName, setCreateName] = useState(``);
  const [createDescription, setCreateDescription] = useState(``);
  const [editingLoop, setEditingLoop] = useState<LoopRecord | null>(null);
  const [editName, setEditName] = useState(``);
  const [editDescription, setEditDescription] = useState(``);
  const [busyLoopId, setBusyLoopId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const resetEditState = () => {
    setEditingLoop(null);
    setEditName(``);
    setEditDescription(``);
    setIsSaving(false);
  };

  const startEditing = (loop: LoopRecord) => {
    setEditingLoop(loop);
    setEditName(loop.name);
    setEditDescription(loop.description ?? ``);
    setFeedback(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    try {
      const loop = await createLoop({
        name: createName,
        description: createDescription,
      });

      setCreateName(``);
      setCreateDescription(``);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop created`,
        message: `${loop.name} is ready to receive events.`,
      });
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to create loop`,
        message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingLoop) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const loop = await updateLoop(editingLoop.id, {
        name: editName,
        description: editDescription,
      });

      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop updated`,
        message: `${loop.name} has been updated.`,
      });
      resetEditState();
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update loop`,
        message,
      });
      setIsSaving(false);
    }
  };

  const handleDelete = async (loop: LoopRecord) => {
    setBusyLoopId(loop.id);
    setFeedback(null);

    try {
      await deleteLoop(loop.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop deleted`,
        message: `${loop.name} has been deleted.`,
      });

      if (editingLoop?.id === loop.id) {
        resetEditState();
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
    <section className="athena-home">
      <p className="p-heading--5">Loops</p>
      <h1 className="p-heading--2">Loops</h1>
      <p className="p-text--default">Create and manage the long-lived loops that hold Athena events.</p>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-strip is-shallow">
        <form onSubmit={handleCreate}>
          <h2 className="p-heading--4">Create loop</h2>
          <label htmlFor="create-loop-name">Loop name</label>
          <input id="create-loop-name" name="create-loop-name" onChange={(event) => setCreateName(event.target.value)} required type="text" value={createName} />
          <label htmlFor="create-loop-description">Loop description</label>
          <textarea id="create-loop-description" name="create-loop-description" onChange={(event) => setCreateDescription(event.target.value)} rows={3} value={createDescription} />
          <Button appearance="positive" disabled={isCreating} type="submit">
            {isCreating ? `Creating loop...` : `Create loop`}
          </Button>
        </form>
      </div>
      {editingLoop ? (
        <div className="p-strip is-shallow">
          <form onSubmit={handleSave}>
            <h2 className="p-heading--4">Edit loop</h2>
            <label htmlFor="edit-loop-name">Loop name</label>
            <input id="edit-loop-name" name="edit-loop-name" onChange={(event) => setEditName(event.target.value)} required type="text" value={editName} />
            <label htmlFor="edit-loop-description">Loop description</label>
            <textarea id="edit-loop-description" name="edit-loop-description" onChange={(event) => setEditDescription(event.target.value)} rows={3} value={editDescription} />
            <div>
              <Button appearance="positive" disabled={isSaving} type="submit">
                {isSaving ? `Saving loop...` : `Save loop`}
              </Button>
              <Button appearance="base" onClick={resetEditState} type="button">
                Cancel edit
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {state.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
          {state.message}
        </Notification>
      ) : null}
      {state.status === `success` && state.loops.length === 0 ? <p className="p-text--default">No loops yet. Create a loop to start organizing events.</p> : null}
      {state.status === `success` && state.loops.length > 0 ? (
        <MainTable
          headers={[{ content: "Name" }, { content: "Description" }, { content: "Updated at" }, { content: "Actions" }]}
          rows={state.loops.map((loop) => ({
            key: loop.id,
            columns: [
              { content: loop.name },
              { content: loop.description ?? "—" },
              { content: formatTimestamp(loop.updatedAt) },
              {
                content: (
                  <div>
                    <Button appearance="base" onClick={() => startEditing(loop)} type="button">
                      {`Edit ${loop.name}`}
                    </Button>
                    <Button appearance="negative" disabled={busyLoopId === loop.id} onClick={() => handleDelete(loop)} type="button">
                      {busyLoopId === loop.id ? `Deleting ${loop.name}...` : `Delete ${loop.name}`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      ) : null}
    </section>
  );
}
