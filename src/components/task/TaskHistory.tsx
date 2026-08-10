import { Button } from "@canonical/react-components";
import { providerToolLabelByName } from "@components/tool/tool.catalog.js";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { usePersonaByIds } from "../persona/persona.query.js";
import { TaskHistoryAthenaDrawer } from "./TaskHistoryAthenaDrawer.js";
import { TaskHistoryMessageBubble } from "./TaskHistoryMessageBubble.js";
import { TaskHistoryPersonaDrawer } from "./TaskHistoryPersonaDrawer.js";
import { TaskHistoryRawJsonDrawer } from "./TaskHistoryRawJsonDrawer.js";
import { TaskHistoryToolCallBubble } from "./TaskHistoryToolCallBubble.js";
import { TaskHistoryToolCallDetailsDrawer } from "./TaskHistoryToolCallDetailsDrawer.js";
import { TaskHistoryToolResultBubble } from "./TaskHistoryToolResultBubble.js";
import { TaskHistoryToolResultDetailsDrawer } from "./TaskHistoryToolResultDetailsDrawer.js";
import { useApproveTaskToolCall, useRejectTaskToolCall } from "./task.query.js";
import type { Task } from "./task.schema";

type TaskHistoryProps = {
  loopId: string;
  task: Task;
  isRawJsonDrawerOpen: boolean;
  onRawJsonDrawerOpenChange: (isOpen: boolean) => void;
};

type SelectedToolCall = {
  queueItemId: string;
  queueItemStatus: Task["queue"][number]["status"];
  id: string;
  name: string;
  label: string;
  arguments: string;
};

type SelectedToolResult = {
  queueItemId: string;
  toolName: string | null;
  toolLabel: string;
  content: string;
};

export function TaskHistory({ loopId, task, isRawJsonDrawerOpen, onRawJsonDrawerOpenChange }: TaskHistoryProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [isAthenaDrawerOpen, setIsAthenaDrawerOpen] = useState(false);
  const [selectedToolCall, setSelectedToolCall] = useState<SelectedToolCall | null>(null);
  const [selectedToolResult, setSelectedToolResult] = useState<SelectedToolResult | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const approveToolCallMutation = useApproveTaskToolCall(loopId, task.id);
  const rejectToolCallMutation = useRejectTaskToolCall(loopId, task.id);
  const messageItems = task.queue.filter((queueItem) => queueItem.type === `message`);
  const personaIds = useMemo(() => Array.from(new Set(messageItems.map((queueItem) => queueItem.persona).filter((personaId): personaId is string => Boolean(personaId)))), [messageItems]);
  const personaById = usePersonaByIds(personaIds);

  useEffect(() => {
    const container = messageContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [task.id, messageItems.length]);

  return (
    <>
      <div style={{ width: "100%", height: "100%", minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "1rem", gap: "0.75rem" }}>
        <div ref={messageContainerRef} style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messageItems.length === 0 ? (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="p-text--default" style={{ margin: 0 }}>
                No messages yet.
              </p>
            </div>
          ) : (
            messageItems.map((queueItem) => {
              const role = queueItem.value.role;
              const isUserMessage = role === `user`;
              const isToolResultMessage = role === `tool`;
              const content = queueItem.value.content ?? ``;
              const toolResultName = isToolResultMessage && typeof queueItem.value.name === "string" && queueItem.value.name.trim().length > 0 ? queueItem.value.name : null;
              const toolResultLabel = toolResultName ? providerToolLabelByName(toolResultName) : "Tool Response";
              const persona = queueItem.persona ? personaById.get(queueItem.persona) : null;
              const personaLabel = persona ? `${persona.displayName}${persona.role ? ` (${persona.role})` : ``}` : null;
              const authorLabel = isToolResultMessage ? `Athena` : (personaLabel ?? (isUserMessage ? (queueItem.userName ?? `User`) : role));
              const authorNode = isToolResultMessage ? (
                <button onClick={() => setIsAthenaDrawerOpen(true)} style={{ all: "unset", cursor: "pointer" }} type="button">
                  {authorLabel}
                </button>
              ) : queueItem.persona ? (
                <button onClick={() => setSelectedPersonaId(queueItem.persona ?? null)} style={{ all: "unset", cursor: "pointer" }} type="button">
                  {authorLabel}
                </button>
              ) : (
                <span>{authorLabel}</span>
              );

              return (
                <TaskHistoryMessageBubble key={queueItem.id} authorNode={authorNode} isUserMessage={isUserMessage} role={role} status={queueItem.status} timestamp={queueItem.timestamp}>
                  {isToolResultMessage ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.25rem" }}>
                      <TaskHistoryToolResultBubble
                        label={toolResultLabel}
                        onShowDetails={() => {
                          setSelectedToolResult({
                            queueItemId: queueItem.id,
                            toolName: toolResultName,
                            toolLabel: toolResultLabel,
                            content,
                          });
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ wordBreak: "break-word", lineHeight: 1.45, overflowX: "auto" }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                        components={{
                          p: ({ children }) => <p style={{ margin: "0 0 0.5rem 0" }}>{children}</p>,
                          ul: ({ children }) => <ul style={{ margin: "0 0 0.5rem 1.2rem", padding: 0 }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ margin: "0 0 0.5rem 1.2rem", padding: 0 }}>{children}</ol>,
                          li: ({ children }) => <li style={{ margin: "0.1rem 0" }}>{children}</li>,
                          pre: ({ children }) => (
                            <pre
                              style={{
                                margin: "0 0 0.5rem 0",
                                padding: "0.5rem",
                                borderRadius: "0.4rem",
                                background: "rgba(0,0,0,0.15)",
                                overflowX: "auto",
                              }}
                            >
                              {children}
                            </pre>
                          ),
                          code: ({ className, children }) => {
                            const isBlockCode = typeof className === "string" && className.includes("language-");

                            return isBlockCode ? <code className={className}>{children}</code> : <code style={{ padding: "0.05rem 0.3rem", borderRadius: "0.25rem", background: "rgba(0,0,0,0.12)" }}>{children}</code>;
                          },
                          a: ({ href, children }) => (
                            <a href={href} rel="noopener noreferrer" style={{ textDecoration: "underline" }} target="_blank">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {content || ""}
                      </ReactMarkdown>
                    </div>
                  )}
                  {queueItem.value.tool_calls?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.25rem" }}>
                      {queueItem.value.tool_calls.map((tc) => (
                        <TaskHistoryToolCallBubble
                          key={tc.id}
                          label={providerToolLabelByName(tc.function.name)}
                          onShowDetails={() => {
                            setSelectedToolCall({
                              queueItemId: queueItem.id,
                              queueItemStatus: queueItem.status,
                              id: tc.id,
                              name: tc.function.name,
                              label: providerToolLabelByName(tc.function.name),
                              arguments: tc.function.arguments,
                            });
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {queueItem.status === `awaiting-approval` ? (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <Button
                        appearance="positive"
                        disabled={approveToolCallMutation.isPending || rejectToolCallMutation.isPending}
                        onClick={() => {
                          void approveToolCallMutation.mutateAsync(queueItem.id);
                        }}
                        type="button"
                      >
                        Approve
                      </Button>
                      <Button
                        appearance="negative"
                        disabled={approveToolCallMutation.isPending || rejectToolCallMutation.isPending}
                        onClick={() => {
                          void rejectToolCallMutation.mutateAsync(queueItem.id);
                        }}
                        type="button"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </TaskHistoryMessageBubble>
              );
            })
          )}
        </div>
      </div>

      <TaskHistoryRawJsonDrawer isOpen={isRawJsonDrawerOpen} onClose={() => onRawJsonDrawerOpenChange(false)} task={task} />

      <TaskHistoryPersonaDrawer isOpen={Boolean(selectedPersonaId)} onClose={() => setSelectedPersonaId(null)} personaId={selectedPersonaId} />

      <TaskHistoryAthenaDrawer isOpen={isAthenaDrawerOpen} onClose={() => setIsAthenaDrawerOpen(false)} />

      <TaskHistoryToolCallDetailsDrawer
        isApprovalPending={approveToolCallMutation.isPending || rejectToolCallMutation.isPending}
        loopId={loopId}
        onApprove={async (queueItemId) => {
          await approveToolCallMutation.mutateAsync(queueItemId);
          setSelectedToolCall(null);
        }}
        onClose={() => setSelectedToolCall(null)}
        onReject={async (queueItemId) => {
          await rejectToolCallMutation.mutateAsync(queueItemId);
          setSelectedToolCall(null);
        }}
        selectedToolCall={selectedToolCall}
      />

      <TaskHistoryToolResultDetailsDrawer onClose={() => setSelectedToolResult(null)} selectedToolResult={selectedToolResult} />
    </>
  );
}
