import { Button } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import ReactJson from "@microlink/react-json-view";
import { useMemo } from "react";
import { useLoopWorkgraphItems } from "../workgraph/workgraph.query.js";
import type { Task } from "./task.schema";

type SelectedToolCall = {
  queueItemId: string;
  queueItemStatus: Task["queue"][number]["status"];
  id: string;
  name: string;
  label: string;
  arguments: string;
};

type TaskHistoryToolCallDetailsDrawerProps = {
  loopId: string;
  selectedToolCall: SelectedToolCall | null;
  isApprovalPending: boolean;
  onClose: () => void;
  onApprove: (queueItemId: string) => Promise<void>;
  onReject: (queueItemId: string) => Promise<void>;
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

const parseWorkgraphItemContext = (argumentsText: string): { workgraphId: string; itemId: string } | null => {
  const parsed = parseToolCallArguments(argumentsText);
  const workgraphId = typeof parsed.workgraph === "string" ? parsed.workgraph.trim() : "";
  const itemId = typeof parsed.item === "string" ? parsed.item.trim() : "";

  if (!workgraphId || !itemId) {
    return null;
  }

  return { workgraphId, itemId };
};

export function TaskHistoryToolCallDetailsDrawer({ loopId, selectedToolCall, isApprovalPending, onClose, onApprove, onReject }: TaskHistoryToolCallDetailsDrawerProps) {
  const selectedToolCallWorkgraphItemContext = useMemo(() => (selectedToolCall ? parseWorkgraphItemContext(selectedToolCall.arguments) : null), [selectedToolCall]);
  const { state: selectedToolCallWorkgraphItemsState } = useLoopWorkgraphItems(loopId, selectedToolCallWorkgraphItemContext?.workgraphId ?? null);
  const selectedToolCallWorkgraphItemTitle = useMemo(() => {
    if (!selectedToolCallWorkgraphItemContext || selectedToolCallWorkgraphItemsState.status !== `success`) {
      return null;
    }

    const matchedItem = selectedToolCallWorkgraphItemsState.items.find((item) => item.id === selectedToolCallWorkgraphItemContext.itemId);

    return matchedItem?.title ?? null;
  }, [selectedToolCallWorkgraphItemContext, selectedToolCallWorkgraphItemsState]);

  return (
    <EntityDrawer isOpen={Boolean(selectedToolCall)} onClose={onClose} size="large" title="Tool call details">
      {selectedToolCall ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Tool:</strong> {selectedToolCall.label}
          </p>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Machine name:</strong> {selectedToolCall.name}
          </p>
          <p className="p-text--small" style={{ margin: 0 }}>
            <strong>Tool call id:</strong> {selectedToolCall.id}
          </p>
          {selectedToolCallWorkgraphItemContext ? (
            <p className="p-text--small" style={{ margin: 0 }}>
              <strong>Workgraph item title:</strong> {selectedToolCallWorkgraphItemTitle ?? `-`}
            </p>
          ) : null}
          {selectedToolCall.queueItemStatus === `awaiting-approval` ? (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                appearance="positive"
                disabled={isApprovalPending}
                onClick={async () => {
                  await onApprove(selectedToolCall.queueItemId);
                }}
                type="button"
              >
                Approve
              </Button>
              <Button
                appearance="negative"
                disabled={isApprovalPending}
                onClick={async () => {
                  await onReject(selectedToolCall.queueItemId);
                }}
                type="button"
              >
                Reject
              </Button>
            </div>
          ) : null}
          <div style={{ maxHeight: "70vh", overflow: "auto" }}>
            <ReactJson src={parseToolCallArguments(selectedToolCall.arguments)} name={false} collapsed={false} displayDataTypes={false} displayObjectSize={false} enableClipboard={true} sortKeys={true} />
          </div>
        </div>
      ) : null}
    </EntityDrawer>
  );
}
