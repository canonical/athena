import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { useLoopReadiness } from "@components/loop/loop.query.js";
import { ChatMessageBody } from "@components/task/ChatMessageBody.js";
import { TaskList } from "@components/task/TaskList.js";
import { createTask, markTaskBlocked, markTaskCompleted, updateTaskContext } from "@components/task/task.client.js";
import { RouteSelectionRequiredClientError } from "@components/task/task.errors.js";
import type { Task, TimelineChatTurn, TimelineEntry } from "@components/task/task.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";

type ChatHistoryMessage = {
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

const toChatHistory = (task: Task): ChatHistoryMessage[] => {
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

export function LoopDashboard({ loopId }: { loopId: string }) {
  const queryClient = useQueryClient();
  const { state: loopReadinessState } = useLoopReadiness(loopId);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [resumedTask, setResumedTask] = useState<Task | null>(null);
  const [blockerReason, setBlockerReason] = useState(``);
  const [lifecycleNote, setLifecycleNote] = useState(``);
  const [feedback, setFeedback] = useState<{ severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity]; title: string; message: string } | null>(null);
  useFeedbackToast(feedback, setFeedback);
  const [routeSelection, setRouteSelection] = useState<{ message: string; options: Array<{ id: string; displayName: string; role: string | null }>; pendingMessage: string } | null>(null);
  const resumedChatHistory = resumedTask ? toChatHistory(resumedTask) : [];

  const loopBlockers = loopReadinessState.status === `success` ? loopReadinessState.readiness.blockers : [];
  const isLoopBlocked = loopReadinessState.status === `success` ? loopReadinessState.readiness.blocked : false;

  const messageFormik = useFormik<{ message: string }>({
    initialValues: { message: `` },
    onSubmit: async (values, helpers) => {
      const message = values.message.trim();

      if (!message) {
        return;
      }

      setFeedback(null);

      try {
        const created = await createTask({
          loop: loopId,
          resumeTaskId: resumedTask?.id,
          sourceType: `chat-ui`,
          description: message,
          payload: { channel: `chat-ui`, timeline: [] },
        });

        const createdOrContinuedTask = created.tasks[0] ?? null;

        if (createdOrContinuedTask) {
          setResumedTask(createdOrContinuedTask);
        }

        helpers.resetForm();
        await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
      } catch (error) {
        if (error instanceof RouteSelectionRequiredClientError) {
          setRouteSelection({ message: error.selection.message, options: error.selection.options, pendingMessage: message });
          return;
        }

        setFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to send message`,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });

  const selectionFormik = useFormik<{ persona: string }>({
    enableReinitialize: true,
    initialValues: {
      persona: routeSelection?.options[0]?.id ?? ``,
    },
    onSubmit: async (values) => {
      if (!routeSelection || !values.persona) {
        return;
      }

      setFeedback(null);

      try {
        await createTask({
          loop: loopId,
          sourceType: `chat-ui`,
          description: routeSelection.pendingMessage,
          assignedPersona: values.persona,
          payload: { channel: `chat-ui`, timeline: [] },
        });

        setRouteSelection(null);
        messageFormik.setFieldValue(`message`, ``);
        await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
      } catch (error) {
        if (error instanceof RouteSelectionRequiredClientError) {
          setRouteSelection({ message: error.selection.message, options: error.selection.options, pendingMessage: routeSelection.pendingMessage });
          return;
        }

        setFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to route message`,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });

  const dismissRouteSelection = () => {
    if (!routeSelection) {
      return;
    }

    messageFormik.setFieldValue(`message`, routeSelection.pendingMessage);
    setRouteSelection(null);
    setIsChatDrawerOpen(true);
  };

  return (
    <>
      <div className="u-clearfix">
        <h2 className="p-heading--3 u-float-left" style={{ margin: 0 }}>
          Dashboard
        </h2>
        <div className="u-float-right">
          <Button
            disabled={isLoopBlocked}
            onClick={() => {
              setResumedTask(null);
              setIsChatDrawerOpen(true);
            }}
          >
            Start Chat
          </Button>
        </div>
      </div>

      {loopReadinessState.status === `success` && isLoopBlocked ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Loop is blocked">
          <ul>
            {loopBlockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
        </Notification>
      ) : null}

      {loopReadinessState.status === `error` ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Unable to load loop readiness">
          {loopReadinessState.message}
        </Notification>
      ) : null}

      <TaskList
        loopId={loopId}
        onContinueChat={(task) => {
          setResumedTask(task);
          setIsChatDrawerOpen(true);
        }}
      />

      <EntityDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => {
          setIsChatDrawerOpen(false);
          setResumedTask(null);
        }}
        title="Chat"
      >
        {resumedTask ? <p className="p-text--small">Resuming Task {resumedTask.id.slice(0, 8)}</p> : null}
        {resumedTask && resumedChatHistory.length > 0 ? (
          <div className="athena-chat-history-block">
            <h5 className="p-heading--5">Chat History</h5>
            <div className="athena-chat-history">
              {resumedChatHistory.map((message) => {
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
          </div>
        ) : null}
        <form className="athena-chat-composer" onSubmit={messageFormik.handleSubmit}>
          <label htmlFor="chat-message-input">Message</label>
          <textarea id="chat-message-input" name="message" onChange={messageFormik.handleChange} rows={4} value={messageFormik.values.message} />
          <div className="u-align--right">
            <Button appearance="positive" disabled={messageFormik.isSubmitting || messageFormik.values.message.trim().length === 0} type="submit">
              {messageFormik.isSubmitting ? `Sending...` : `Send`}
            </Button>
            <Button
              appearance="positive"
              disabled={messageFormik.isSubmitting}
              onClick={() => {
                void (async () => {
                  try {
                    setFeedback(null);
                    await markTaskCompleted({ loop: loopId, taskId: resumedTask?.id, note: lifecycleNote || undefined });
                    await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
                    setIsChatDrawerOpen(false);
                  } catch (error) {
                    setFeedback({
                      severity: NotificationSeverity.NEGATIVE,
                      title: `Unable to complete task`,
                      message: error instanceof Error ? error.message : String(error),
                    });
                  }
                })();
              }}
              type="button"
            >
              Mark Task Complete
            </Button>
            <Button
              appearance="negative"
              disabled={messageFormik.isSubmitting || blockerReason.trim().length === 0}
              onClick={() => {
                void (async () => {
                  try {
                    setFeedback(null);
                    await markTaskBlocked({ loop: loopId, taskId: resumedTask?.id, blocker: blockerReason.trim(), note: lifecycleNote || undefined });
                    await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
                    setIsChatDrawerOpen(false);
                    setBlockerReason(``);
                  } catch (error) {
                    setFeedback({
                      severity: NotificationSeverity.NEGATIVE,
                      title: `Unable to mark task blocked`,
                      message: error instanceof Error ? error.message : String(error),
                    });
                  }
                })();
              }}
              type="button"
            >
              Mark Blocked
            </Button>
            <Button
              appearance="base"
              disabled={messageFormik.isSubmitting || lifecycleNote.trim().length === 0}
              onClick={() => {
                void (async () => {
                  try {
                    setFeedback(null);
                    await updateTaskContext({ loop: loopId, taskId: resumedTask?.id, context: lifecycleNote.trim(), note: `Manual context compaction update.` });
                    await queryClient.invalidateQueries({ queryKey: [`tasks`, loopId] });
                  } catch (error) {
                    setFeedback({
                      severity: NotificationSeverity.NEGATIVE,
                      title: `Unable to update context`,
                      message: error instanceof Error ? error.message : String(error),
                    });
                  }
                })();
              }}
              type="button"
            >
              Update Context
            </Button>
          </div>
          <label htmlFor="chat-lifecycle-note">Lifecycle note (optional)</label>
          <textarea id="chat-lifecycle-note" name="lifecycle-note" onChange={(event) => setLifecycleNote(event.target.value)} rows={2} value={lifecycleNote} />
          <label htmlFor="chat-blocker-reason">Blocker reason (required for Mark Blocked)</label>
          <textarea id="chat-blocker-reason" name="blocker-reason" onChange={(event) => setBlockerReason(event.target.value)} rows={2} value={blockerReason} />
        </form>
      </EntityDrawer>

      <EntityDrawer isOpen={routeSelection !== null} onClose={dismissRouteSelection} title="Select persona">
        <p className="p-text--default">{routeSelection?.message}</p>
        <form onSubmit={selectionFormik.handleSubmit}>
          <Select
            id="route-selection-persona"
            label="Persona"
            name="persona"
            onChange={selectionFormik.handleChange}
            options={(routeSelection?.options ?? []).map((option) => ({ value: option.id, label: option.role ? `${option.displayName} (${option.role})` : option.displayName }))}
            value={selectionFormik.values.persona}
          />
          <div className="u-align--right">
            <Button appearance="base" disabled={selectionFormik.isSubmitting} onClick={dismissRouteSelection} type="button">
              Back to message
            </Button>
            <Button appearance="positive" disabled={!selectionFormik.values.persona || selectionFormik.isSubmitting} type="submit">
              {selectionFormik.isSubmitting ? `Routing...` : `Continue`}
            </Button>
          </div>
        </form>
      </EntityDrawer>
    </>
  );
}
