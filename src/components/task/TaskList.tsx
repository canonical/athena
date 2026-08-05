import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { ChatMessageBody } from "./ChatMessageBody.js";
import { useTasks } from "./task.query.js";
import type { Task, TimelineChatTurn, TimelineEntry } from "./task.schema.js";
import "./task.scss";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

type ChatMessage = {
  id: string;
  messageType: `user` | `assistant`;
  message: string;
  responderName?: string;
};

const readTimeline = (task: Task): TimelineEntry[] => (Array.isArray(task.payload.timeline) ? task.payload.timeline : []);

const readResponderName = (task: Task): string | undefined => {
  const explicitName = task.payload.routing?.selectedPersonaDisplayName?.trim();

  if (explicitName) {
    return explicitName;
  }

  const timeline = readTimeline(task);

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    const actor = entry?.actor?.trim();

    if (!actor || actor === `chat-ui` || actor === `system`) {
      continue;
    }

    return actor;
  }

  return undefined;
};

const summarizeTimelineEntry = (entry: TimelineEntry): string => {
  if (entry.type === `chat-session` && isRecord(entry.data) && Array.isArray(entry.data.turns)) {
    const turns = entry.data.turns as TimelineChatTurn[];
    return `${turns.length} turn(s)`;
  }

  if (entry.type === `task-blocked` && isRecord(entry.data) && typeof entry.data.blocker === `string`) {
    return `Blocker: ${entry.data.blocker}`;
  }

  if (entry.type === `system-action-result` && isRecord(entry.data) && typeof entry.data.summary === `string`) {
    return entry.data.summary;
  }

  if (entry.type === `routing-decision` && isRecord(entry.data) && typeof entry.data.selectedPersonaDisplayName === `string`) {
    const targetType = typeof entry.data.targetType === `string` ? entry.data.targetType : null;
    return targetType ? `Assigned: ${entry.data.selectedPersonaDisplayName} via ${targetType}` : `Assigned: ${entry.data.selectedPersonaDisplayName}`;
  }

  return ``;
};

const toChatMessages = (task: Task): ChatMessage[] => {
  const responderName = readResponderName(task);

  return readTimeline(task).flatMap((entry) => {
    if (entry.type !== `chat-session`) {
      return [];
    }

    const turns = isRecord(entry.data) && Array.isArray(entry.data.turns) ? (entry.data.turns as TimelineChatTurn[]) : [];

    return turns
      .filter((turn): turn is TimelineChatTurn => isRecord(turn) && typeof turn.message === `string` && (turn.speaker === `user` || turn.speaker === `assistant`))
      .map((turn, index) => ({
        id: `${entry.id}-${index}`,
        messageType: turn.speaker === `user` ? `user` : `assistant`,
        message: turn.message,
        responderName: turn.speaker === `assistant` ? responderName : undefined,
      }));
  });
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatUsd = (value: number): string => `$${value.toFixed(6)}`;

const timelineCounts = (task: Task): Array<{ type: string; count: number }> => {
  const counts = new Map<string, number>();

  for (const entry of readTimeline(task)) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }

  return [...counts.entries()].map(([type, count]) => ({ type, count }));
};

type TaskListProps = {
  loopId: string;
  onContinueChat?: (task: Task) => void;
};

export function TaskList({ loopId, onContinueChat }: TaskListProps) {
  const { state: tasksState } = useTasks(loopId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loopTasks = useMemo(() => (tasksState.status === `success` ? tasksState.tasks.filter((task) => task.sourceType === `chat-ui`) : []), [tasksState]);

  useEffect(() => {
    if (loopTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !loopTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(loopTasks[0]?.id ?? null);
    }
  }, [loopTasks, selectedTaskId]);

  const selectedTask = loopTasks.find((task) => task.id === selectedTaskId) ?? null;
  const chatMessages = selectedTask ? toChatMessages(selectedTask) : [];

  return (
    <div className="p-card p-strip is-shallow">
      {tasksState.status === `loading` ? <p className="p-text--default">Loading chat history...</p> : null}
      {tasksState.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load chat">
          {tasksState.message}
        </Notification>
      ) : null}
      {tasksState.status === `success` && loopTasks.length === 0 ? <p className="p-text--default">No tasks yet. Click "Start Chat" to begin a conversation.</p> : null}
      {tasksState.status === `success` && loopTasks.length > 0 && selectedTask ? (
        <div className="athena-task-inspector">
          <aside className="athena-task-inspector__sidebar">
            <h4 className="p-heading--5">Tasks</h4>
            <ul className="p-list--divided athena-task-list">
              {loopTasks.map((task, index) => {
                const isSelected = task.id === selectedTask.id;
                return (
                  <li className="athena-task-list__item" key={task.id}>
                    <button className={`athena-task-list__button${isSelected ? ` is-selected` : ``}`} onClick={() => setSelectedTaskId(task.id)} type="button">
                      <span className="athena-task-list__title">Task {loopTasks.length - index}</span>
                      <span className="athena-task-list__meta">
                        {task.phase} / {task.status}
                      </span>
                      <span className="athena-task-list__meta">Updated {formatDateTime(task.updatedAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="athena-task-inspector__detail">
            <div className="athena-task-detail-grid">
              <article className="athena-task-card">
                <h5 className="p-heading--5">Task</h5>
                <p className="p-text--default athena-task-card__lead">{selectedTask.description}</p>
                <p className="p-text--small">Phase: {selectedTask.phase}</p>
                <p className="p-text--small">Status: {selectedTask.status}</p>
                <p className="p-text--small">Context: {selectedTask.context}</p>
                <p className="p-text--small">Requested outcome: {selectedTask.description ?? `n/a`}</p>
                {selectedTask.status === `requires-user-input` ? (
                  <div className="u-no-margin--top">
                    <Button appearance="positive" onClick={() => onContinueChat?.(selectedTask)} type="button">
                      Continue Chat
                    </Button>
                  </div>
                ) : null}
              </article>

              <article className="athena-task-card">
                <h5 className="p-heading--5">Routing</h5>
                <p className="p-text--small">Selected persona: {selectedTask.payload.routing?.selectedPersonaDisplayName ?? `n/a`}</p>
                <p className="p-text--small">Reason: {selectedTask.routeReasonText ?? selectedTask.routeReasonCode ?? `n/a`}</p>
                <p className="p-text--small">Route attempts: {selectedTask.routing?.routeAttempts ?? 0}</p>
                <p className="p-text--small">Routing context mode: {selectedTask.payload.routing?.conversationMode ?? `n/a`}</p>
                <p className="p-text--small">Routed target type: {selectedTask.payload.routing?.targetType ?? selectedTask.targetType ?? `n/a`}</p>
                <p className="p-text--small">Resolved target: {selectedTask.targetType && selectedTask.targetId ? `${selectedTask.targetType}:${selectedTask.targetId}` : `n/a`}</p>
              </article>

              <article className="athena-task-card">
                <h5 className="p-heading--5">History</h5>
                <p className="p-text--small">Created: {formatDateTime(selectedTask.emittedAt)}</p>
                <p className="p-text--small">Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                <p className="p-text--small">Completed: {selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : `n/a`}</p>
                <p className="p-text--small">Autonomy iterations completed: {selectedTask.autonomyIterationCount}</p>
                <p className="p-text--small">Pinged: {selectedTask.pingedAt ? formatDateTime(selectedTask.pingedAt) : `n/a`}</p>
                <p className="p-text--small">Claim owner: {selectedTask.claimOwner ?? `n/a`}</p>
                <p className="p-text--small">Claim token: {selectedTask.claimToken ?? `n/a`}</p>
                <p className="p-text--small">Claim attempts: {selectedTask.claimAttemptCount}</p>
                <p className="p-text--small">Total LLM cost: {formatUsd(selectedTask.llmCostUsdTotal ?? 0)}</p>
                <p className="p-text--small">Timeline entries: {readTimeline(selectedTask).length}</p>
              </article>
            </div>

            <div className="athena-chat-history-block">
              <h5 className="p-heading--5">Chat History</h5>
              {chatMessages.length === 0 ? <p className="p-text--default">No chat turns recorded for this task.</p> : null}
              {chatMessages.length > 0 ? (
                <div className="athena-chat-history">
                  {chatMessages.map((message) => {
                    const isAssistant = message.messageType === `assistant`;

                    return (
                      <article className={`athena-chat-message${isAssistant ? ` is-assistant` : ` is-user`}`} key={message.id}>
                        <header className="athena-chat-message__header">
                          <strong>{isAssistant ? (message.responderName ? `Responder ${message.responderName}` : `Responder`) : `You`}</strong>
                          {isAssistant ? <span className="athena-chat-message__chip">{message.responderName ?? `Responder`}</span> : null}
                        </header>
                        <ChatMessageBody message={message.message} />
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="athena-timeline-block">
              <h5 className="p-heading--5">Timeline</h5>
              <div className="athena-timeline-summary">
                {timelineCounts(selectedTask).map((item) => (
                  <span className="athena-timeline-pill" key={item.type}>
                    {item.type}: {item.count}
                  </span>
                ))}
              </div>

              <ul className="p-list--divided athena-timeline-list">
                {readTimeline(selectedTask).map((entry) => (
                  <li key={entry.id}>
                    <p className="p-text--small">
                      <strong>{entry.type}</strong> by {entry.actor} at {formatDateTime(entry.timestamp)}
                    </p>
                    {summarizeTimelineEntry(entry) ? <p className="p-text--small">{summarizeTimelineEntry(entry)}</p> : null}
                    <details>
                      <summary className="p-text--small">Entry payload</summary>
                      <pre className="athena-json-block">{JSON.stringify(entry.data, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            </div>

            <div className="athena-payload-block">
              <h5 className="p-heading--5">Raw Task Payload</h5>
              <pre className="athena-json-block">{JSON.stringify(selectedTask.payload, null, 2)}</pre>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
