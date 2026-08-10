import { Button, Input } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useState } from "react";
import type { Task } from "./task.schema.js";

type TaskEditMetadataDrawerProps = {
  task: Task;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string, objective: string) => Promise<void>;
};

export function TaskEditMetadataDrawer({ task, isOpen, isSaving, onClose, onSave }: TaskEditMetadataDrawerProps) {
  const [title, setTitle] = useState(task.title ?? ``);
  const [objective, setObjective] = useState(task.currentObjective ?? ``);

  const handleSave = async () => {
    await onSave(title.trim(), objective.trim());
  };

  return (
    <EntityDrawer isOpen={isOpen} onClose={onClose} title="Edit task metadata">
      <div style={{ display: `flex`, flexDirection: `column`, gap: `1rem` }}>
        <Input
          id="metadata-title"
          label="Title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === `Enter`) void handleSave();
          }}
          type="text"
          value={title}
        />
        <div>
          <label className="p-form__label" htmlFor="metadata-objective">
            Objective
          </label>
          <textarea
            className="p-form__control"
            id="metadata-objective"
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Describe the current objective for this task…"
            rows={8}
            style={{ width: `100%`, resize: `vertical` }}
            value={objective}
          />
        </div>
        <div style={{ display: `flex`, gap: `0.5rem`, justifyContent: `flex-end` }}>
          <Button appearance="base" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button appearance="positive" disabled={isSaving || !title.trim()} onClick={() => void handleSave()} type="button">
            Save
          </Button>
        </div>
      </div>
    </EntityDrawer>
  );
}
