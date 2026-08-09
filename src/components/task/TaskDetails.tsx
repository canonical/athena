import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEffect, useRef, useState } from "react";
import { TaskAssignWorkgraphItemDrawer } from "./TaskAssignWorkgraphItemDrawer.js";
import { TaskEditMetadataDrawer } from "./TaskEditMetadataDrawer.js";
import { TaskHistory } from "./TaskHistory.js";
import { useAppendTaskUserMessage, useAssignTaskWorkgraphItem, useTask, useUpdateTaskObjective, useUpdateTaskTitle } from "./task.query.js";

type TaskDetailsProps = {
  loopId: string;
  taskId: string;
};

export function TaskDetails({ loopId, taskId }: TaskDetailsProps) {
  const { state } = useTask(loopId, taskId);
  const appendTaskUserMessageMutation = useAppendTaskUserMessage(loopId, taskId);
  const updateTitleMutation = useUpdateTaskTitle(loopId, taskId);
  const updateObjectiveMutation = useUpdateTaskObjective(loopId, taskId);
  const assignWorkgraphItemMutation = useAssignTaskWorkgraphItem(loopId, taskId);

  const [message, setMessage] = useState(``);
  const [isRawJsonDrawerOpen, setIsRawJsonDrawerOpen] = useState(false);
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [isCompactOpen, setIsCompactOpen] = useState(false);

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state.status !== `success`) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loopId, taskId, state.status]);

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

  const handleSaveMetadata = async (title: string, objective: string) => {
    if (title && title !== task.title) {
      await updateTitleMutation.mutateAsync(title);
    }

    if (objective !== (task.currentObjective ?? ``)) {
      await updateObjectiveMutation.mutateAsync(objective);
    }

    setIsMetadataDrawerOpen(false);
  };

  const handleCompact = async () => {
    await appendTaskUserMessageMutation.mutateAsync(`Please compact the conversation history using the athena_compact_queue tool. Generate a concise summary that preserves the current state, decisions, blockers, and next actions.`);
    setIsCompactOpen(false);
  };

  const handleAssign = async (itemId: string) => {
    await assignWorkgraphItemMutation.mutateAsync(itemId);
    setIsAssignDrawerOpen(false);
  };

  const isSavingMetadata = updateTitleMutation.isPending || updateObjectiveMutation.isPending;

  return (
    <div style={{ height: `100vh`, width: `100%`, display: `flex`, flexDirection: `column`, overflow: `hidden` }}>
      {/* Title + objective + actions row */}
      <div style={{ width: `100%`, padding: `0.5rem 1rem`, boxSizing: `border-box`, flexShrink: 0, display: `flex`, alignItems: `center`, gap: `0.5rem` }}>
        <div style={{ flex: 1, display: `flex`, flexDirection: `column`, minWidth: 0, gap: `0.1rem` }}>
          <strong style={{ overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap` }}>
            <span style={{ opacity: 0.5, fontWeight: `normal` }}>Title: </span>
            {task.title}
          </strong>
          {task.currentObjective && (
            <span style={{ overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap`, opacity: 0.65, fontSize: `0.8125rem` }}>
              <span style={{ opacity: 0.8 }}>Objective: </span>
              {task.currentObjective}
            </span>
          )}
        </div>
        <Button appearance="base" hasIcon onClick={() => setIsMetadataDrawerOpen(true)} style={{ margin: 0, padding: `0.2rem`, flexShrink: 0 }} title="Edit title and objective" type="button">
          <i className="p-icon--edit" />
        </Button>
        <div style={{ display: `flex`, gap: `0.5rem`, flexShrink: 0 }}>
          <Button appearance="positive" onClick={() => setIsCompactOpen((v) => !v)} type="button">
            Compact
          </Button>
          <Button appearance="positive" onClick={() => setIsAssignDrawerOpen(true)} type="button">
            Assign
          </Button>
          <Button appearance="positive" onClick={() => setIsRawJsonDrawerOpen(true)} type="button">
            Raw JSON
          </Button>
        </div>
      </div>

      {/* Compact form */}
      {isCompactOpen && (
        <div style={{ padding: `0.5rem 1rem`, borderTop: `1px solid rgba(0,0,0,0.1)`, borderBottom: `1px solid rgba(0,0,0,0.1)`, flexShrink: 0, display: `flex`, flexDirection: `column`, gap: `0.5rem` }}>
          <p className="p-text--small" style={{ margin: 0 }}>
            The LLM will generate a summary of the conversation and call the compact tool. You will be asked to approve before anything is committed.
          </p>
          <div style={{ display: `flex`, gap: `0.5rem` }}>
            <Button appearance="positive" disabled={appendTaskUserMessageMutation.isPending} onClick={() => void handleCompact()} type="button">
              Request Compact
            </Button>
            <Button appearance="base" onClick={() => setIsCompactOpen(false)} type="button">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, width: `100%`, minHeight: 0, overflow: `hidden` }}>
        <TaskHistory isRawJsonDrawerOpen={isRawJsonDrawerOpen} loopId={loopId} onRawJsonDrawerOpenChange={setIsRawJsonDrawerOpen} task={task} />
      </div>

      <div style={{ width: `100%`, boxSizing: `border-box`, flexShrink: 0, display: `flex`, gap: 0, padding: `1rem`, height: `9.375rem` }}>
        <textarea
          ref={messageInputRef}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === `Enter`) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Write a message"
          style={{ flex: 1, height: `100%`, minHeight: 0, resize: `none`, boxSizing: `border-box`, border: 0, outline: `none` }}
          value={message}
        />
        <Button appearance="positive" disabled={appendTaskUserMessageMutation.isPending} onClick={() => void handleSend()} style={{ height: `100%`, alignSelf: `stretch`, flexShrink: 0, margin: 0 }} type="button">
          Send
        </Button>
      </div>

      {/* Assign workgraph item drawer */}
      {isAssignDrawerOpen && <TaskAssignWorkgraphItemDrawer isOpen={isAssignDrawerOpen} isSaving={assignWorkgraphItemMutation.isPending} loopId={loopId} onClose={() => setIsAssignDrawerOpen(false)} onSave={handleAssign} task={task} />}

      {isMetadataDrawerOpen && <TaskEditMetadataDrawer isOpen={isMetadataDrawerOpen} isSaving={isSavingMetadata} onClose={() => setIsMetadataDrawerOpen(false)} onSave={handleSaveMetadata} task={task} />}
    </div>
  );
}
