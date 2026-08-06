import { Button, Icon, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEffect, useMemo, useState } from "react";
import { useTasks } from "./task.query.js";
import type { Task } from "./task.schema.js";
import "./task.scss";

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

type TaskListProps = {
  loopId: string;
  selectedTaskId?: string | null;
  onSelectTask?: (task: Task) => void;
};

export function TaskList({ loopId, selectedTaskId: controlledSelectedTaskId, onSelectTask }: TaskListProps) {
  const { state: tasksState } = useTasks(loopId);
  const [internalSelectedTaskId, setInternalSelectedTaskId] = useState<string | null>(null);

  const loopTasks = useMemo(() => (tasksState.status === `success` ? tasksState.tasks : []), [tasksState]);
  const filteredTasks = loopTasks;

  const selectedTaskId = controlledSelectedTaskId ?? internalSelectedTaskId;

  useEffect(() => {
    if (controlledSelectedTaskId !== undefined) {
      return;
    }

    if (filteredTasks.length === 0) {
      setInternalSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setInternalSelectedTaskId(filteredTasks[0]?.id ?? null);
    }
  }, [controlledSelectedTaskId, filteredTasks, selectedTaskId]);

  const selectTask = (task: Task) => {
    onSelectTask?.(task);

    if (controlledSelectedTaskId === undefined) {
      setInternalSelectedTaskId(task.id);
    }
  };

  return (
    <div>
      {tasksState.status === `loading` ? <p className="p-text--default">Loading tasks...</p> : null}
      {tasksState.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load tasks">
          {tasksState.message}
        </Notification>
      ) : null}
      {tasksState.status === `success` && loopTasks.length === 0 ? <p className="p-text--default">No tasks yet for this loop.</p> : null}
      {tasksState.status === `success` && filteredTasks.length > 0 ? (
        <div>
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Task` }, { content: `Source` }, { content: `Phase` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions`, className: `u-align--right` }]}
            rows={filteredTasks.map((task, index) => ({
              key: task.id,
              columns: [
                { content: `Task ${filteredTasks.length - index}${selectedTaskId === task.id ? ` (selected)` : ``}` },
                { content: task.sourceType },
                { content: task.phase },
                { content: task.status },
                { content: formatDateTime(task.updatedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button appearance="base" aria-label={`Open task ${task.id}`} onClick={() => selectTask(task)} title={`Open task ${task.id}`} type="button">
                        <Icon aria-hidden="true" name="copy" />
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
