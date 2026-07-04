import { Button } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useState } from "react";
import { LoopEditor } from "./LoopEditor.js";
import type { LoopDetailsProps } from "./loop.schema.js";

export function LoopDetails({ loopId, loopName, loopDescription, onFeedback, onSaved }: LoopDetailsProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <div className="p-card p-strip is-shallow">
      <h2 className="p-heading--4">Loop details</h2>
      <dl>
        <dt>Name</dt>
        <dd>{loopName}</dd>
        <dt>Description</dt>
        <dd>{loopDescription || `-`}</dd>
      </dl>
      <div className="u-align--right">
        <Button appearance="base" onClick={() => setIsEditorOpen(true)} type="button">
          Edit loop
        </Button>
      </div>
      <EntityDrawer isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} title="Edit loop">
        <LoopEditor
          loop={{ createdAt: ``, description: loopDescription, id: loopId, name: loopName, updatedAt: `` }}
          onSuccess={(feedback) => {
            onFeedback(feedback);
            onSaved();
            setIsEditorOpen(false);
          }}
        />
      </EntityDrawer>
    </div>
  );
}
