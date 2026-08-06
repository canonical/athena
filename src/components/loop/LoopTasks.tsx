import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useLoopReadiness } from "@components/loop/loop.query.js";
import { TaskList } from "@components/task/TaskList.js";
import { useNavigate } from "@tanstack/react-router";

export function LoopTasks({ loopId, taskId }: { loopId: string; taskId?: string }) {
  const navigate = useNavigate();
  const { state: loopReadinessState } = useLoopReadiness(loopId);

  const loopBlockers = loopReadinessState.status === `success` ? loopReadinessState.readiness.blockers : [];
  const isLoopBlocked = loopReadinessState.status === `success` ? loopReadinessState.readiness.blocked : false;

  return (
    <div className="athena-tasks-shell">
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
        selectedTaskId={taskId ?? null}
        onSelectTask={(task) => {
          void navigate({ to: `/loop/$loopId/task/$taskId`, params: { loopId, taskId: task.id } });
        }}
      />
    </div>
  );
}
