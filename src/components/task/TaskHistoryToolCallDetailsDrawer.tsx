import { Button } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import ReactJson from "@microlink/react-json-view";
import { useState } from "react";
import type { Task } from "./task.schema";

type SelectedToolCall = {
  queueItemId: string;
  queueItemStatus: Task["queue"][number]["status"];
  toolCalls: Array<{ id: string; name: string; label: string; arguments: string }>;
};

type TaskHistoryToolCallDetailsDrawerProps = {
  loopId: string;
  selectedToolCall: SelectedToolCall | null;
  isApprovalPending: boolean;
  onClose: () => void;
  onApprove: (queueItemId: string, message?: string) => Promise<void>;
  onReject: (queueItemId: string, message?: string) => Promise<void>;
};

const parseToolCallArguments = (argumentsText: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(argumentsText) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return { value: parsed };
  } catch {
    return { value: argumentsText };
  }
};

export function TaskHistoryToolCallDetailsDrawer({ selectedToolCall, isApprovalPending, onClose, onApprove, onReject }: TaskHistoryToolCallDetailsDrawerProps) {
  const [approvalMessage, setApprovalMessage] = useState(``);
  const toolCount = selectedToolCall?.toolCalls.length ?? 0;
  const title = toolCount === 1 ? `Tool call details` : `Tool call details (${toolCount})`;

  return (
    <EntityDrawer isOpen={Boolean(selectedToolCall)} onClose={onClose} size="large" title={title}>
      {selectedToolCall ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {selectedToolCall.toolCalls.map((tc, index) => (
            <div key={tc.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {toolCount > 1 ? (
                <p className="p-text--small" style={{ margin: 0, fontWeight: 600 }}>
                  Tool call {index + 1} of {toolCount}
                </p>
              ) : null}
              <p className="p-text--small" style={{ margin: 0 }}>
                <strong>Tool:</strong> {tc.label}
              </p>
              <p className="p-text--small" style={{ margin: 0 }}>
                <strong>Machine name:</strong> {tc.name}
              </p>
              <p className="p-text--small" style={{ margin: 0 }}>
                <strong>Tool call id:</strong> {tc.id}
              </p>
              <ReactJson collapsed={false} displayDataTypes={false} displayObjectSize={false} enableClipboard={true} name={false} sortKeys={true} src={parseToolCallArguments(tc.arguments)} />
            </div>
          ))}

          {selectedToolCall.queueItemStatus === `awaiting-approval` ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "1px solid var(--color-mid-light)", paddingTop: "1rem" }}>
              <label className="p-text--small" htmlFor="approval-message" style={{ margin: 0 }}>
                Message <span style={{ color: "var(--color-mid-dark)" }}>(optional)</span>
              </label>
              <textarea id="approval-message" onChange={(e) => setApprovalMessage(e.target.value)} placeholder="Add a note for the LLM…" rows={3} style={{ resize: "vertical", width: "100%" }} value={approvalMessage} />
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <Button
                  appearance="negative"
                  disabled={isApprovalPending}
                  onClick={async () => {
                    await onReject(selectedToolCall.queueItemId, approvalMessage.trim() || undefined);
                    setApprovalMessage(``);
                  }}
                  type="button"
                >
                  Reject
                </Button>
                <Button
                  appearance="positive"
                  disabled={isApprovalPending}
                  onClick={async () => {
                    await onApprove(selectedToolCall.queueItemId, approvalMessage.trim() || undefined);
                    setApprovalMessage(``);
                  }}
                  type="button"
                >
                  Approve
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </EntityDrawer>
  );
}
