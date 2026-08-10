import { MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import type { ToastFeedback } from "@components/base/toast.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { Fab } from "@components/fab/Fab.js";
import { useLoopReadiness } from "@components/loop/loop.query.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateTask, useTasks } from "./task.query.js";

const taskStatusLabel: Record<string, string> = {
  queued: `Queued`,
  wip: `In progress`,
  completed: `Completed`,
};

const taskSourceLabel: Record<string, string> = {
  user: `User`,
  workgraphItem: `Workgraph item`,
};

export function TaskList({ loopId }: { loopId: string }) {
  const navigate = useNavigate();
  const { state: tasksState } = useTasks(loopId);
  const createTaskMutation = useCreateTask(loopId);
  const { state: loopReadinessState } = useLoopReadiness(loopId);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<ToastFeedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const loopBlockers = loopReadinessState.status === `success` ? loopReadinessState.readiness.blockers : [];
  const isLoopBlocked = loopReadinessState.status === `success` ? loopReadinessState.readiness.blocked : false;

  const submitCreate = async (title?: string) => {
    setIsCreating(true);

    try {
      const createdTask = await createTaskMutation.mutateAsync(title);
      void navigate({ to: `/loop/$loopId/task/$taskId`, params: { loopId, taskId: createdTask.id } });
    } catch (error) {
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to create task`,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
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

      <MainTable
        className="u-table-layout--auto"
        headers={[{ content: `Task` }, { content: `Status` }, { content: `Source` }]}
        rows={(tasksState.status === `success` ? tasksState.tasks : []).map((task) => ({
          key: task.id,
          columns: [
            {
              content: (
                <Link params={{ loopId, taskId: task.id }} to={`/loop/$loopId/task/$taskId`}>
                  {task.title ?? `Untitled task`}
                </Link>
              ),
            },
            { content: taskStatusLabel[task.status] ?? task.status },
            { content: taskSourceLabel[task.source] ?? task.source },
          ],
        }))}
      />

      {tasksState.status === `loading` ? <p className="p-text--default">Loading tasks...</p> : null}
      {tasksState.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load tasks">
          {tasksState.message}
        </Notification>
      ) : null}

      <Fab disabled={isLoopBlocked || isCreating} title="New Task" onClick={() => void submitCreate(`New Task`)} />
    </section>
  );
}
