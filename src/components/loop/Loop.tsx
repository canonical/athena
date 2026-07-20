import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { usePersonaList } from "../persona/persona.query.js";
import { LoopDetails } from "./LoopDetails.js";
import { LoopHarnesses } from "./LoopHarnesses.js";
import { LoopPersonas } from "./LoopPersonas.js";
import { LoopProviders } from "./LoopProviders.js";
import { useLoop } from "./loop.query.js";
import type { Feedback, LoopProps, Tab } from "./loop.schema.js";

export function Loop({ loopId, tab, editor, personaId }: LoopProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const { state: personaListState, reload: reloadPersonaList } = usePersonaList(loopId);
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loop = loopState.status === `success` ? loopState.loop : null;

  const personas = personaListState.status === `success` ? personaListState.personas : null;
  const activeRoutingCount = personas !== null ? personas.filter((p) => p.isRouting && p.lifecycleStatus === `active`).length : null;

  const routingPausedMessage =
    activeRoutingCount === 0
      ? `This loop has no active routing persona and is paused. Go to the Personas tab and assign or activate a routing persona.`
      : activeRoutingCount !== null && activeRoutingCount > 1
        ? `This loop has ${activeRoutingCount} active routing personas and is paused. Exactly one is required. Go to the Personas tab and remove or archive the extras.`
        : null;

  const setTab = (next: Tab) => {
    void navigate({ params: { loopId }, search: { tab: next, create: undefined, edit: undefined, clone: undefined }, to: `/loop/$loopId` });
    setFeedback(null);
  };

  if (loopState.status === `loading`) {
    return (
      <section className="p-strip is-shallow u-no-max-width">
        <h1 className="p-heading--2">Loop</h1>
        <p className="p-text--default">Loading loop...</p>
      </section>
    );
  }

  if (loopState.status === `error`) {
    return (
      <section className="p-strip is-shallow u-no-max-width">
        <h1 className="p-heading--2">Loop</h1>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop">
          {loopState.message}
        </Notification>
      </section>
    );
  }

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{loop?.name ?? `Loop`}</h1>
      {routingPausedMessage ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Loop is paused">
          {routingPausedMessage}
        </Notification>
      ) : null}
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <nav aria-label="Loop sections" className="p-tabs">
        <div role="tablist">
          <ul className="p-tabs__list">
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `details`} className={`p-tabs__link${tab === `details` ? ` is-active` : ``}`} onClick={() => setTab(`details`)} role="tab" type="button">
                Details
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `personas`} className={`p-tabs__link${tab === `personas` ? ` is-active` : ``}`} onClick={() => setTab(`personas`)} role="tab" type="button">
                Personas
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `providers`} className={`p-tabs__link${tab === `providers` ? ` is-active` : ``}`} onClick={() => setTab(`providers`)} role="tab" type="button">
                Providers
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `harnesses`} className={`p-tabs__link${tab === `harnesses` ? ` is-active` : ``}`} onClick={() => setTab(`harnesses`)} role="tab" type="button">
                Harnesses
              </button>
            </li>
          </ul>
        </div>
      </nav>
      {tab === `details` ? <LoopDetails loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} onFeedback={setFeedback} onSaved={reloadLoop} /> : null}
      {tab === `personas` ? <LoopPersonas editor={editor} loopId={loopId} onFeedback={setFeedback} personaId={personaId} personaListState={personaListState} reloadPersonaList={reloadPersonaList} /> : null}
      {tab === `providers` ? <LoopProviders loopId={loopId} onFeedback={setFeedback} /> : null}
      {tab === `harnesses` ? <LoopHarnesses loopId={loopId} onFeedback={setFeedback} /> : null}
    </section>
  );
}
