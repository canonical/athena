import { Button, NotificationSeverity } from "@canonical/react-components";
import { type FormEvent, useState } from "react";
import { updateLoop } from "./loop.client.js";
import type { LoopDetailsProps } from "./loop.schema.js";
import { loopUpdateSchema } from "./loop.schema.js";

export function LoopDetails({ loopId, loopName, loopDescription, onFeedback, onSaved }: LoopDetailsProps) {
  const [editName, setEditName] = useState(loopName);
  const [editDescription, setEditDescription] = useState(loopDescription);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parseResult = loopUpdateSchema.safeParse({ name: editName, description: editDescription });

    if (!parseResult.success) {
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update loop`,
        message: parseResult.error.issues[0]?.message ?? `Invalid input.`,
      });
      return;
    }

    setIsSaving(true);
    onFeedback(null);

    try {
      const updated = await updateLoop(loopId, { name: editName, description: editDescription });
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Loop updated`,
        message: `${updated.name} has been updated.`,
      });
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update loop`,
        message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-strip is-shallow">
      <form onSubmit={handleSave}>
        <h2 className="p-heading--4">Loop details</h2>
        <label htmlFor="loop-detail-name">Loop name</label>
        <input id="loop-detail-name" name="loop-detail-name" onChange={(event) => setEditName(event.target.value)} required type="text" value={editName} />
        <label htmlFor="loop-detail-description">Loop description</label>
        <textarea id="loop-detail-description" name="loop-detail-description" onChange={(event) => setEditDescription(event.target.value)} rows={3} value={editDescription} />
        <Button appearance="positive" disabled={isSaving} type="submit">
          {isSaving ? `Saving loop...` : `Save loop`}
        </Button>
      </form>
    </div>
  );
}
