import { Button, Icon } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useState } from "react";
import { LoopEditor } from "./LoopEditor.js";
import type { LoopDetailsProps } from "./loop.schema.js";

const formatUsd = (value: number | null): string => {
  if (value === null) {
    return `Not set`;
  }

  return `$${value.toFixed(6)}`;
};

export function LoopDetails({ loopId, loopName, loopDescription, loopIterationCostLimitUsd, onFeedback, onSaved }: LoopDetailsProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <>
      <div className="u-clearfix">
        <div className="u-float-left">
          <h2 className="p-heading--4">Loop details</h2>
        </div>
        <div className="u-float-right">
          <Button appearance="positive" onClick={() => setIsEditorOpen(true)} type="button">
            <Icon aria-hidden="true" light name="edit" />
            Edit loop
          </Button>
        </div>
      </div>
      <hr />
      <dl>
        <dt>Name</dt>
        <dd>{loopName}</dd>
        <dt>Description</dt>
        <dd>{loopDescription || `-`}</dd>
        <dt>Per-iteration cost limit</dt>
        <dd>{formatUsd(loopIterationCostLimitUsd)}</dd>
      </dl>
      <EntityDrawer isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} title="Edit loop">
        <LoopEditor
          loop={{ createdAt: ``, description: loopDescription, id: loopId, name: loopName, iterationCostLimitUsd: loopIterationCostLimitUsd, updatedAt: `` }}
          onSuccess={(feedback) => {
            onFeedback(feedback);
            onSaved();
            setIsEditorOpen(false);
          }}
        />
      </EntityDrawer>
    </>
  );
}
