import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { Fab } from "@components/fab/Fab.js";
import { useState } from "react";
import { TaskHistory } from "./TaskHistory.js";
import { useAppendTaskUserMessage, useResetTaskProcessorClaims, useTask } from "./task.query.js";

type TaskDetailsProps = {
  loopId: string;
  taskId: string;
};

export function TaskDetails({ loopId, taskId }: TaskDetailsProps) {
  const { state } = useTask(loopId, taskId);
  const resetTaskProcessorClaimsMutation = useResetTaskProcessorClaims(loopId, taskId);
  const appendTaskUserMessageMutation = useAppendTaskUserMessage(loopId, taskId);
  const [message, setMessage] = useState(``);

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    await appendTaskUserMessageMutation.mutateAsync(trimmedMessage);
    setMessage(``);
  };

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading task...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load task">
        {state.message}
      </Notification>
    );
  }

  const task = state.task;

  const handleResetProcessorClaims = async () => {
    await resetTaskProcessorClaimsMutation.mutateAsync();
  };

  return (
    <div style={{ height: "100vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Fab
        disabled={resetTaskProcessorClaimsMutation.isPending}
        icon={
          <span aria-hidden="true" style={{ fontSize: "1.25rem", lineHeight: 1 }}>
            ↻
          </span>
        }
        onClick={() => {
          void handleResetProcessorClaims();
        }}
        position="topRight"
        title="Reset processor claims"
      />

      <div style={{ height: "3.125rem", width: "100%", padding: "1rem", boxSizing: "border-box", flexShrink: 0 }}>
        <strong>{task.title}</strong>
      </div>

      <div style={{ flex: 1, width: "100%", minHeight: 0, overflow: "hidden" }}>
        <TaskHistory loopId={loopId} task={task} />
      </div>

      <div
        style={{
          height: "9.375rem",
          width: "100%",
          boxSizing: "border-box",
          flexShrink: 0,
          display: "flex",
          gap: 0,
          padding: "1rem",
        }}
      >
        <textarea
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === `Enter`) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Write a message"
          style={{
            flex: 1,
            height: "100%",
            minHeight: 0,
            resize: "none",
            boxSizing: "border-box",
            border: 0,
            outline: "none",
          }}
          value={message}
        />
        <Button appearance="positive" disabled={appendTaskUserMessageMutation.isPending} onClick={() => void handleSend()} style={{ height: "100%", alignSelf: "stretch", flexShrink: 0, margin: 0 }} type="button">
          Send
        </Button>
      </div>
    </div>
  );
}
