import { Notification, NotificationSeverity } from "@canonical/react-components";
import type { TaskSource } from "@components/task/task.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteTaskSourceStepSequence, upsertTaskSourceStepSequence } from "../stepSequence/stepSequence.client.js";
import { stepSequenceQueryKeys, useStepSequenceList, useTaskSourceStepSequenceList } from "../stepSequence/stepSequence.query.js";
import type { LoopStepDefinitionsProps } from "./loop.schema.js";

const taskSources: { value: TaskSource; label: string }[] = [
  { value: `user`, label: `User requests` },
  { value: `workgraphItem`, label: `Workgraph items` },
];

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === `string`) return error;
  if (typeof error === `number`) return error.toString();
  if (typeof error === `boolean`) return error ? `true` : `false`;
  try {
    return JSON.stringify(error) ?? `Unexpected error.`;
  } catch {
    return `Unexpected error.`;
  }
};

export function LoopStepDefinitions(props: Readonly<LoopStepDefinitionsProps>) {
  const { loopId, onFeedback } = props;
  const queryClient = useQueryClient();
  const sequenceQuery = useStepSequenceList(loopId);
  const sequences = sequenceQuery.data ?? [];
  const mappingsQuery = useTaskSourceStepSequenceList(loopId);
  const mappings = mappingsQuery.data ?? [];
  const [busySource, setBusySource] = useState<TaskSource | null>(null);

  const handleChange = async (taskSource: TaskSource, stepSequence: string) => {
    setBusySource(taskSource);
    onFeedback(null);

    try {
      if (stepSequence) {
        await upsertTaskSourceStepSequence(loopId, { taskSource, stepSequence });
      } else if (mappings.some((mapping) => mapping.taskSource === taskSource)) {
        await deleteTaskSourceStepSequence(loopId, taskSource);
      }

      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.mappings(loopId) });
      const sourceLabel = taskSources.find((source) => source.value === taskSource)?.label ?? taskSource;
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: `Task-source mapping updated`, message: `${sourceLabel} mapping has been saved.` });
    } catch (error) {
      onFeedback({ severity: NotificationSeverity.NEGATIVE, title: `Unable to update task-source mapping`, message: errorMessage(error) });
    } finally {
      setBusySource(null);
    }
  };

  return (
    <section>
      <h2 className="p-heading--4">Task-source mappings</h2>
      <hr />
      {sequenceQuery.isPending ? <p className="p-text--default">Loading step sequences...</p> : null}
      {sequenceQuery.isError ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load step sequences">
          {errorMessage(sequenceQuery.error)}
        </Notification>
      ) : null}
      {mappingsQuery.isPending ? <p className="p-text--default">Loading task-source mappings...</p> : null}
      {mappingsQuery.isError ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load task-source mappings">
          {errorMessage(mappingsQuery.error)}
        </Notification>
      ) : null}
      {sequenceQuery.isSuccess && mappingsQuery.isSuccess
        ? taskSources.map((source) => {
            const mapping = mappings.find((item) => item.taskSource === source.value);

            return (
              <div className="p-form__group" key={source.value}>
                <label htmlFor={`step-source-${source.value}`}>{source.label}</label>
                <select
                  disabled={sequences.length === 0 || busySource === source.value}
                  id={`step-source-${source.value}`}
                  onChange={(event) => void handleChange(source.value, event.currentTarget.value)}
                  value={mapping?.stepSequence ?? ``}
                >
                  <option value="">Use loop default</option>
                  {sequences.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })
        : null}
    </section>
  );
}
