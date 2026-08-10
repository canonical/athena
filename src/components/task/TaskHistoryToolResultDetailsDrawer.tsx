import { EntityDrawer } from "@components/base/EntityDrawer.js";
import ReactJson from "@microlink/react-json-view";

type SelectedToolResult = {
  queueItemId: string;
  toolName: string | null;
  toolLabel: string;
  content: string;
};

type TaskHistoryToolResultDetailsDrawerProps = {
  selectedToolResult: SelectedToolResult | null;
  onClose: () => void;
};

const parseToolResultContent = (content: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(content) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return { value: parsed };
  } catch {
    return { value: content };
  }
};

export function TaskHistoryToolResultDetailsDrawer({ selectedToolResult, onClose }: TaskHistoryToolResultDetailsDrawerProps) {
  return (
    <EntityDrawer isOpen={Boolean(selectedToolResult)} onClose={onClose} size="large" title="Tool response details">
      {selectedToolResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Tool:</strong> {selectedToolResult.toolLabel}
          </p>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Machine name:</strong> {selectedToolResult.toolName ?? "-"}
          </p>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Queue item id:</strong> {selectedToolResult.queueItemId}
          </p>
          <div style={{ maxHeight: "70vh", overflow: "auto" }}>
            <ReactJson src={parseToolResultContent(selectedToolResult.content)} name={false} collapsed={false} displayDataTypes={false} displayObjectSize={false} enableClipboard={true} sortKeys={true} />
          </div>
        </div>
      ) : null}
    </EntityDrawer>
  );
}
