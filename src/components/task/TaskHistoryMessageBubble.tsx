import type { ReactNode } from "react";
import { formatTimestamp, readRoleBubbleBackground } from "./TaskHistoryBubble.utils.js";

type TaskHistoryMessageBubbleProps = {
  role: string;
  isUserMessage: boolean;
  authorNode: ReactNode;
  status: string | null;
  timestamp: string;
  children: ReactNode;
};

export function TaskHistoryMessageBubble({ role, isUserMessage, authorNode, status, timestamp, children }: TaskHistoryMessageBubbleProps) {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: isUserMessage ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "min(42rem, 85%)",
          borderRadius: "0.9rem",
          padding: "0.65rem 0.85rem",
          background: readRoleBubbleBackground(role),
          backdropFilter: "blur(2px)",
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "0.5rem",
            fontSize: "0.72rem",
            opacity: 0.8,
            letterSpacing: "0.02em",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {authorNode}
            {status === `pending` ? <span style={{ opacity: 0.7 }}>{status}</span> : null}
          </div>
        </div>
        {children}
        <div style={{ alignSelf: "flex-end", fontSize: "0.68rem", opacity: 0.65 }}>{formatTimestamp(timestamp)}</div>
      </div>
    </div>
  );
}
