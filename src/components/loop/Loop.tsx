import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { LoopDetails } from "./LoopDetails.js";
import { LoopPersonas } from "./LoopPersonas.js";
import { useLoop } from "./loop.query.js";
import type { Feedback, LoopProps, Tab } from "./loop.schema.js";

export function Loop({ loopId, tab }: LoopProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeRoutingCount, setActiveRoutingCount] = useState<number | null>(null);

  const loop = loopState.status === `success` ? loopState.loop : null;

  const handleRoutingStatusChange = useCallback((count: number) => {
    setActiveRoutingCount(count);
  }, []);

  const isPaused = activeRoutingCount !== 1;

  const pausedMessage =
    activeRoutingCount === 0
      ? `This loop has no active routing persona and is paused. Go to the Personas tab and assign or activate a routing persona.`
      : activeRoutingCount !== null && activeRoutingCount > 1
        ? `This loop has ${activeRoutingCount} active routing personas and is paused. Exactly one is required. Go to the Personas tab and remove or archive the extras.`
        : null;

  const setTab = (next: Tab) => {
    void navigate({ to: `/loop/$loopId`, params: { loopId }, search: { tab: next } });
    setFeedback(null);
  };

  if (loopState.status === `loading`) {
    return <p className="p-text--default">Loading loop...</p>;
  }

  if (loopState.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop">
        {loopState.message}
      </Notification>
    );
  }

  return (
    <>
      <h1 className="p-heading--2">{loop?.name ?? `Loop`}</h1>
      {isPaused && pausedMessage ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Loop is paused">
          {pausedMessage}
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
              <button
                aria-selected={tab === `details`}
                className={`p-tabs__link${tab === `details` ? ` is-active` : ``}`}
                onClick={() => setTab(`details`)}
                role="tab"
                type="button"
              >
                Details
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button
                aria-selected={tab === `personas`}
                className={`p-tabs__link${tab === `personas` ? ` is-active` : ``}`}
                onClick={() => setTab(`personas`)}
                role="tab"
                type="button"
              >
                Personas
              </button>
            </li>
          </ul>
        </div>
      </nav>
      {tab === `details` ? <LoopDetails loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} onFeedback={setFeedback} onSaved={reloadLoop} /> : null}
      {tab === `personas` ? <LoopPersonas loopId={loopId} onFeedback={setFeedback} onRoutingStatusChange={handleRoutingStatusChange} /> : null}
    </>
  );
}
