import { Notification, NotificationSeverity } from "@canonical/react-components";
import { usePersonaById } from "./persona.query.js";
import type { PersonaDetailProps } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

export function Persona({ personaId }: PersonaDetailProps) {
  const { state } = usePersonaById(personaId);

  const persona = state.status === `success` ? state.persona : null;

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
    </section>
  );
}
