import { EntityDrawer } from "@components/base/EntityDrawer.js";
import ReactJson from "@microlink/react-json-view";
import type { Task } from "./task.schema";

type TaskHistoryRawJsonDrawerProps = {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
};

export function TaskHistoryRawJsonDrawer({ task, isOpen, onClose }: TaskHistoryRawJsonDrawerProps) {
  return (
    <EntityDrawer isOpen={isOpen} onClose={onClose} size="large" title="Task Raw JSON">
      <div style={{ maxHeight: "80vh", overflow: "auto" }}>
        <ReactJson src={task} name={false} collapsed={false} displayDataTypes={false} displayObjectSize={false} enableClipboard={true} sortKeys={true} />
      </div>
    </EntityDrawer>
  );
}
