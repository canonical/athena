import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChatMessageBody } from "./ChatMessageBody.js";
import { createTask } from "./task.client.js";
import type { PendingToolApprovalRequest, Task, TimelineChatTurn, TimelineEntry } from "./task.schema.js";

type ChatMessage = {
  id: string;
  messageType: `user` | `assistant`;
  message: string;
  responderName?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

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

const timelineCounts = (task: Task): Array<{ type: string; count: number }> => {
  const counts = new Map<string, number>();

  for (const entry of readTimeline(task)) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }

  return [...counts.entries()].map(([type, count]) => ({ type, count }));
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatUsd = (value: number): string => `$${value.toFixed(6)}`;

const generateApprovalDescription = (toolCall: PendingToolApprovalRequest[`toolCall`]): string => {
  const tool = toolCall.tool;
  const input = toolCall.input as Record<string, unknown> | undefined;

  if (!input) {
    return tool;
  }

  const issueKey = typeof input.issueKey === "string" ? input.issueKey : typeof input.issueId === "string" ? input.issueId : null;

  if (tool === `jira_transition_issue` && issueKey && typeof input.transitionId === "string") {
    return `Transition issue ${issueKey} to state ${input.transitionId}`;
  }

  if (tool === `jira_edit_field` && issueKey && typeof input.fieldId === "string" && typeof input.value === "string") {
    const valuePreview = input.value.length > 40 ? `${input.value.substring(0, 37)}...` : input.value;
    return `Edit field ${input.fieldId} of issue ${issueKey} to: "${valuePreview}"`;
  }

  if (tool === `jira_create_issue` && typeof input.summary === "string") {
    const issuetype = typeof input.issuetype === "string" ? input.issuetype : "";
    const typeText = issuetype ? ` as ${issuetype}` : "";
    const summaryPreview = input.summary.length > 50 ? `${input.summary.substring(0, 47)}...` : input.summary;
    return `Create new Jira issue${typeText}: "${summaryPreview}"`;
  }

  if (tool === `jira_add_labels` && issueKey && Array.isArray(input.labels)) {
    const labels = input.labels as unknown[];
    const labelList = labels.filter((l): l is string => typeof l === "string").join(", ");
    return `Add labels to issue ${issueKey}: ${labelList}`;
  }

  if (tool === `jira_remove_labels` && issueKey && Array.isArray(input.labels)) {
    const labels = input.labels as unknown[];
    const labelList = labels.filter((l): l is string => typeof l === "string").join(", ");
    return `Remove labels from issue ${issueKey}: ${labelList}`;
  }

  if (tool === `jira_add_comment` && issueKey && typeof input.comment === "string") {
    const commentPreview = input.comment.length > 60 ? `${input.comment.substring(0, 57)}...` : input.comment;
    return `Add comment to issue ${issueKey}: "${commentPreview}"`;
  }

  if (Object.keys(input).length > 0) {
    return `${tool}: ${JSON.stringify(input)}`;
  }

  return tool;
};

const formatApprovalToolCall = (toolCall: PendingToolApprovalRequest[`toolCall`]): string => {
  return generateApprovalDescription(toolCall);
};

const readPendingToolApprovalRequest = (task: Task): PendingToolApprovalRequest | null => {
  if (task.status !== `requires-user-approval`) {
    return null;
  }

  return task.payload.pendingToolApprovalRequest ?? null;
};

type TaskDetailsProps = {
  loopId: string;
  task: Task | null;
  onContinueChat?: (task: Task) => void;
};

export function TaskDetails({ loopId, task, onContinueChat }: TaskDetailsProps) {
  const queryClient = useQueryClient();
  const [approvalMessage, setApprovalMessage] = useState(``);
  const [approvalBusy, setApprovalBusy] = useState<`approved` | `rejected` | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const chatMessages = useMemo(() => (task ? toChatMessages(task) : []), [task]);
  const pendingApproval = useMemo(() => (task ? readPendingToolApprovalRequest(task) : null), [task]);

  const submitApprovalDecision = async (decision: `approved` | `rejected`) => {
    if (!task || !pendingApproval) {
      return;
    }

    setApprovalBusy(decision);
    setApprovalError(null);

    const payloadMessage = decision === `approved` ? `Approval approved.` : `Approval rejected.`;
    const approvalDecisionMessage = approvalMessage.trim().length > 0 ? approvalMessage.trim() : undefined;

    try {
      await createTask({
        loop: loopId,
        resumeTaskId: task.id,
        sourceType: task.sourceType,
        description: payloadMessage,
        approvalDecision: {
          decision,
          requestId: pendingApproval.requestId,
          ...(approvalDecisionMessage ? { message: approvalDecisionMessage } : {}),
        },
        payload: { channel: `chat-ui`, timeline: [] },
      });

      setApprovalMessage(``);
      await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : String(error));
    } finally {
      setApprovalBusy(null);
    }
  };

  if (!task) {
    return <p className="p-text--default">Select a task to view details.</p>;
  }

  return (
    <section>
      {approvalError ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to submit approval decision">
          {approvalError}
        </Notification>
      ) : null}

      <div className="athena-task-detail-grid">
        <article className="athena-task-card">
          <h5 className="p-heading--5">Task</h5>
          <p className="p-text--default athena-task-card__lead">{task.description}</p>
          <p className="p-text--small">Phase: {task.phase}</p>
          <p className="p-text--small">Status: {task.status}</p>
          <p className="p-text--small">Source: {task.sourceType}</p>
          <p className="p-text--small">Context: {task.context}</p>
          <p className="p-text--small">Requested outcome: {task.description ?? `n/a`}</p>
          {task.status === `requires-user-approval` && pendingApproval ? (
            <div className="athena-approval-actions">
              <p className="p-text--small">Approval request: {pendingApproval.requestId}</p>
              {pendingApproval.requestedTools.length > 0 ? <p className="p-text--small">Requested tools: {pendingApproval.requestedTools.join(`, `)}</p> : null}
              <p className="p-text--small">Requested tool call: {formatApprovalToolCall(pendingApproval.toolCall)}</p>
              <label className="u-no-margin--bottom" htmlFor="task-approval-message">
                Message (optional)
              </label>
              <textarea id="task-approval-message" onChange={(event) => setApprovalMessage(event.target.value)} placeholder="Optional message for Athena/LLM" rows={3} value={approvalMessage} />
              <div className="athena-approval-actions__buttons">
                <Button appearance="positive" disabled={approvalBusy !== null} onClick={() => void submitApprovalDecision(`approved`)} type="button">
                  {approvalBusy === `approved` ? `Approving...` : `Approve`}
                </Button>
                <Button appearance="negative" disabled={approvalBusy !== null} onClick={() => void submitApprovalDecision(`rejected`)} type="button">
                  {approvalBusy === `rejected` ? `Rejecting...` : `Reject`}
                </Button>
              </div>
            </div>
          ) : null}
          {task.status === `requires-user-input` ? (
            <div className="u-no-margin--top">
              <Button appearance="positive" onClick={() => onContinueChat?.(task)} type="button">
                Continue Chat
              </Button>
            </div>
          ) : null}
        </article>

        <article className="athena-task-card">
          <h5 className="p-heading--5">Routing</h5>
          <p className="p-text--small">Selected persona: {task.payload.routing?.selectedPersonaDisplayName ?? `n/a`}</p>
          <p className="p-text--small">Reason: {task.routeReasonText ?? task.routeReasonCode ?? `n/a`}</p>
          <p className="p-text--small">Route attempts: {task.routing?.routeAttempts ?? 0}</p>
          <p className="p-text--small">Routing context mode: {task.payload.routing?.conversationMode ?? `n/a`}</p>
          <p className="p-text--small">Routed target type: {task.payload.routing?.targetType ?? task.targetType ?? `n/a`}</p>
          <p className="p-text--small">Resolved target: {task.targetType && task.targetId ? `${task.targetType}:${task.targetId}` : `n/a`}</p>
        </article>

        <article className="athena-task-card">
          <h5 className="p-heading--5">History</h5>
          <p className="p-text--small">Created: {formatDateTime(task.emittedAt)}</p>
          <p className="p-text--small">Updated: {formatDateTime(task.updatedAt)}</p>
          <p className="p-text--small">Completed: {task.completedAt ? formatDateTime(task.completedAt) : `n/a`}</p>
          <p className="p-text--small">Autonomy iterations completed: {task.autonomyIterationCount}</p>
          <p className="p-text--small">Pinged: {task.pingedAt ? formatDateTime(task.pingedAt) : `n/a`}</p>
          <p className="p-text--small">Claim owner: {task.claimOwner ?? `n/a`}</p>
          <p className="p-text--small">Claim token: {task.claimToken ?? `n/a`}</p>
          <p className="p-text--small">Claim attempts: {task.claimAttemptCount}</p>
          <p className="p-text--small">Total LLM cost: {formatUsd(task.llmCostUsdTotal ?? 0)}</p>
          <p className="p-text--small">Timeline entries: {readTimeline(task).length}</p>
        </article>
      </div>

      <div className="athena-chat-history-block">
        <h5 className="p-heading--5">Chat History</h5>
        {chatMessages.length === 0 ? <p className="p-text--default">No chat turns recorded for this task source.</p> : null}
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
          {timelineCounts(task).map((item) => (
            <span className="athena-timeline-pill" key={item.type}>
              {item.type}: {item.count}
            </span>
          ))}
        </div>

        <ul className="p-list--divided athena-timeline-list">
          {readTimeline(task).map((entry) => (
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
        <pre className="athena-json-block">{JSON.stringify(task.payload, null, 2)}</pre>
      </div>
    </section>
  );
}
