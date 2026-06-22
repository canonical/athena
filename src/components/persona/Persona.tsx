import type { Persona as PersonaRecord } from "./persona.schema.js";

const lifecycleStatusLabel: Record<string, string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type PersonaProps = {
  persona: PersonaRecord;
};

export function Persona({ persona }: PersonaProps) {
  return (
    <div>
      <p className="p-heading--5">{persona.isEngineeringManager ? `${persona.displayName} (EM)` : persona.displayName}</p>
      <dl>
        <dt>Lifecycle status</dt>
        <dd>{lifecycleStatusLabel[persona.lifecycleStatus] ?? persona.lifecycleStatus}</dd>
        <dt>Routing priority</dt>
        <dd>{persona.routingPriority}</dd>
        <dt>Coding harness</dt>
        <dd>{persona.usesCodingHarness ? `Yes` : `No`}</dd>
        <dt>Engineering manager</dt>
        <dd>{persona.isEngineeringManager ? `Yes` : `No`}</dd>
        <dt>Personality</dt>
        <dd style={{ whiteSpace: `pre-wrap` }}>{persona.personality}</dd>
      </dl>
    </div>
  );
}
