import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useLoopList } from "@components/loop/loop.query.js";
import { useFormik } from "formik";
import { useState } from "react";
import { assignPersonaToLoop } from "./persona.client.js";
import { usePersonaById } from "./persona.query.js";
import type { Feedback, PersonaDetailProps } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function Persona({ personaId }: PersonaDetailProps) {
  const { state, reload } = usePersonaById(personaId);
  const { state: loopListState } = useLoopList();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loopList = loopListState.status === `success` ? loopListState.loops : [];

  const persona = state.status === `success` ? state.persona : null;

  const assignFormik = useFormik<{ selectedLoopId: string }>({
    initialValues: { selectedLoopId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedLoopId || !persona) {
        return;
      }

      setFeedback(null);

      try {
        await assignPersonaToLoop(values.selectedLoopId, personaId);
        const loopName = loopList.find((l) => l.id === values.selectedLoopId)?.name ?? values.selectedLoopId;
        setFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Persona assigned`,
          message: `${persona.displayName} has been assigned to ${loopName}.`,
        });
        helpers.resetForm();
        reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign persona`,
          message,
        });
      }
    },
  });

  if (state.status === `loading`) {
    return (
      <section className="p-strip is-shallow u-no-max-width">
        <h1 className="p-heading--2">Persona</h1>
        <p className="p-text--default">Loading persona...</p>
      </section>
    );
  }

  if (state.status === `error`) {
    return (
      <section className="p-strip is-shallow u-no-max-width">
        <h1 className="p-heading--2">Persona</h1>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load persona">
          {state.message}
        </Notification>
      </section>
    );
  }

  if (!persona) {
    return (
      <section className="p-strip is-shallow u-no-max-width">
        <h1 className="p-heading--2">Persona</h1>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load persona">
          Persona not found.
        </Notification>
      </section>
    );
  }

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{persona.isRouting ? `${persona.displayName} (R)` : persona.displayName}</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Persona details</h2>
        <dl>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus}</dd>
          <dt>Routing persona</dt>
          <dd>{persona.isRouting ? `Yes` : `No`}</dd>
          <dt>Default persona</dt>
          <dd>{persona.isDefault ? `Yes` : `No`}</dd>
          <dt>Role</dt>
          <dd>{persona.role ?? `-`}</dd>
          <dt>Personality</dt>
          <dd>
            <pre>{persona.personality}</pre>
          </dd>
        </dl>
      </div>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assign to loop</h2>
        {loopListState.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
        {loopListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
            {loopListState.message}
          </Notification>
        ) : null}
        {loopListState.status === `success` && loopList.length === 0 ? <p className="p-text--default">No loops available. Create a loop first.</p> : null}
        {loopListState.status === `success` && loopList.length > 0 ? (
          <form onSubmit={assignFormik.handleSubmit}>
            <Select
              id="persona-assign-loop"
              label="Loop"
              name="selectedLoopId"
              onChange={assignFormik.handleChange}
              options={[{ value: ``, label: `— Select a loop —` }, ...loopList.map((l) => ({ value: l.id, label: l.name }))]}
              value={assignFormik.values.selectedLoopId}
            />
            <div className="u-align--right">
              <Button appearance="positive" disabled={!assignFormik.values.selectedLoopId || assignFormik.isSubmitting} type="submit">
                {assignFormik.isSubmitting ? `Assigning...` : `Assign to loop`}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
