import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { createStepSequence } from "../stepSequence/stepSequence.client.js";
import { stepSequenceQueryKeys, useStepSequenceList } from "../stepSequence/stepSequence.query.js";
import type { StepSequenceWritable } from "../stepSequence/stepSequence.schema.js";
import { LoopStepSequenceEditor, type StepSequenceEditor, type StepSequenceFormValues } from "./LoopStepSequenceEditor.js";
import type { LoopStepSequencesProps } from "./loop.schema.js";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === `string`) return error;
  try {
    return JSON.stringify(error) ?? `Unexpected error.`;
  } catch {
    return `Unexpected error.`;
  }
};

export function LoopStepSequences(props: Readonly<LoopStepSequencesProps>) {
  const { loopId, onFeedback } = props;
  const queryClient = useQueryClient();
  const sequenceQuery = useStepSequenceList(loopId);
  const sequences = sequenceQuery.data ?? [];
  const [editor, setEditor] = useState<StepSequenceEditor | null>(null);

  const saveSequence = async (values: StepSequenceFormValues, activeEditor: StepSequenceEditor | null) => {
    if (activeEditor?.mode !== `create`) return;
    onFeedback(null);

    try {
      const saved = await createStepSequence(loopId, values satisfies StepSequenceWritable);
      setEditor(null);
      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.sequences(loopId) });
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: `Sequence created`, message: `${saved.name} has been saved.` });
    } catch (error) {
      onFeedback({ severity: NotificationSeverity.NEGATIVE, title: `Unable to create sequence`, message: errorMessage(error) });
    }
  };

  return (
    <>
      <section>
        <div className="u-clearfix">
          <div className="u-float-left">
            <h2 className="p-heading--4">Step sequences</h2>
          </div>
          <div className="u-float-right">
            <Button appearance="positive" onClick={() => setEditor({ mode: `create` })} type="button">
              Create sequence
            </Button>
          </div>
        </div>
        <hr />
        {sequenceQuery.isPending ? <p className="p-text--default">Loading step sequences...</p> : null}
        {sequenceQuery.isError ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load step sequences">
            {errorMessage(sequenceQuery.error)}
          </Notification>
        ) : null}
        {sequenceQuery.isSuccess && sequences.length === 0 ? <p className="p-text--default">No step sequences configured.</p> : null}
        {sequenceQuery.isSuccess && sequences.length > 0 ? (
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Sequence` }, { content: `Default` }]}
            rows={sequences.map((sequence) => ({
              key: sequence.id,
              columns: [
                {
                  content: (
                    <Link params={{ loopId, stepSequenceId: sequence.id }} to="/loop/$loopId/step-sequences/$stepSequenceId">
                      {sequence.name}
                    </Link>
                  ),
                },
                { content: sequence.isDefault ? `Yes` : `-` },
              ],
            }))}
          />
        ) : null}
      </section>
      <LoopStepSequenceEditor editor={editor} onClose={() => setEditor(null)} onSubmit={saveSequence} />
    </>
  );
}
