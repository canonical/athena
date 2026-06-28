import { Button, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { useLoops } from "@components/loop/loop.query.js";
import { type FormEvent, useState } from "react";
import { assignPersonaToLoop } from "./persona.client.js";
import { usePersonaById } from "./persona.query.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type PersonaDetailProps = {
  personaId: string;
};

export function Persona({ personaId }: PersonaDetailProps) {
  const { state, reload } = usePersonaById(personaId);
  const { state: loopsState } = useLoops();
  const [selectedLoopId, setSelectedLoopId] = useState(``);
  const [isAssigning, setIsAssigning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loops = loopsState.status === `success` ? loopsState.loops : [];

  if (state.status === `loading`) {
    return (
      <section className="athena-home">
        <p className="p-text--default">Loading persona...</p>
      </section>
    );
  }

  if (state.status === `error`) {
    return (
      <section className="athena-home">
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load persona">
          {state.message}
        </Notification>
      </section>
    );
  }

  const persona = state.persona;

  const handleAssign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedLoopId) {
      return;
    }

    setIsAssigning(true);
    setFeedback(null);

    try {
      await assignPersonaToLoop(selectedLoopId, personaId);
      const loopName = loops.find((l) => l.id === selectedLoopId)?.name ?? selectedLoopId;
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Persona assigned`,
        message: `${persona.displayName} has been assigned to ${loopName}.`,
      });
      setSelectedLoopId(``);
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to assign persona`,
        message,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <section className="athena-home">
      <p className="p-heading--5">Personas</p>
      <h1 className="p-heading--2">{persona.isEngineeringManager ? `${persona.displayName} (EM)` : persona.displayName}</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-strip is-shallow">
        <h2 className="p-heading--4">Persona details</h2>
        <dl>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus}</dd>
          <dt>Routing priority</dt>
          <dd>{persona.routingPriority}</dd>
          <dt>Coding harness</dt>
          <dd>{persona.usesCodingHarness ? `Yes` : `No`}</dd>
          <dt>Engineering manager</dt>
          <dd>{persona.isEngineeringManager ? `Yes` : `No`}</dd>
          <dt>Default persona</dt>
          <dd>{persona.isDefault ? `Yes` : `No`}</dd>
          <dt>Personality</dt>
          <dd style={{ whiteSpace: `pre-wrap` }}>{persona.personality}</dd>
        </dl>
      </div>
      <div className="p-strip is-shallow">
        <h2 className="p-heading--4">Assign to loop</h2>
        {loopsState.status === `loading` ? <p className="p-text--default">Loading loops...</p> : null}
        {loopsState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loops">
            {loopsState.message}
          </Notification>
        ) : null}
        {loopsState.status === `success` && loops.length === 0 ? (
          <p className="p-text--default">No loops available. Create a loop first.</p>
        ) : null}
        {loopsState.status === `success` && loops.length > 0 ? (
          <form onSubmit={handleAssign}>
            <Select
              id="persona-assign-loop"
              label="Loop"
              onChange={(event) => setSelectedLoopId(event.target.value)}
              options={[{ value: ``, label: `— Select a loop —` }, ...loops.map((l) => ({ value: l.id, label: l.name }))]}
              value={selectedLoopId}
            />
            <Button appearance="positive" disabled={!selectedLoopId || isAssigning} type="submit">
              {isAssigning ? `Assigning...` : `Assign to loop`}
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
