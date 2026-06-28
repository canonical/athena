import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useCallback, useState } from "react";
import { LoopDetails } from "./LoopDetails.js";
import { LoopPersonas } from "./LoopPersonas.js";
import { useLoop } from "./loop.query.js";
import type { Feedback, LoopProps, Tab } from "./loop.schema.js";

export function Loop({ loopId }: LoopProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const [activeTab, setActiveTab] = useState<Tab>(`details`);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeRoutingCount, setActiveRoutingCount] = useState<number | null>(null);

  const loop = loopState.status === `success` ? loopState.loop : null;

  const handleRoutingStatusChange = useCallback((count: number) => {
    setActiveRoutingCount(count);
  }, []);

  const isPaused = activeRoutingCount !== null && activeRoutingCount !== 1;

  const pausedMessage =
    activeRoutingCount === 0
      ? `This loop has no active routing persona and is paused. Go to the Personas tab and assign or activate a routing persona.`
      : activeRoutingCount !== null && activeRoutingCount > 1
        ? `This loop has ${activeRoutingCount} active routing personas and is paused. Exactly one is required. Go to the Personas tab and remove or archive the extras.`
        : null;

  if (loopState.status === `loading`) {
    return (
      <section className="athena-home">
        <p className="p-text--default">Loading loop...</p>
      </section>
    );
  }

  if (loopState.status === `error`) {
    return (
      <section className="athena-home">
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop">
          {loopState.message}
        </Notification>
      </section>
    );
  }

  return (
    <section className="athena-home">
      <p className="p-heading--5">Loops</p>
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
                aria-selected={activeTab === `details`}
                className={`p-tabs__link${activeTab === `details` ? ` is-active` : ``}`}
                onClick={() => {
                  setActiveTab(`details`);
                  setFeedback(null);
                }}
                role="tab"
                type="button"
              >
                Details
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button
                aria-selected={activeTab === `personas`}
                className={`p-tabs__link${activeTab === `personas` ? ` is-active` : ``}`}
                onClick={() => {
                  setActiveTab(`personas`);
                  setFeedback(null);
                }}
                role="tab"
                type="button"
              >
                Personas
              </button>
            </li>
          </ul>
        </div>
      </nav>
      {activeTab === `details` ? <LoopDetails loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} onFeedback={setFeedback} onSaved={reloadLoop} /> : null}
      {activeTab === `personas` ? <LoopPersonas loopId={loopId} onFeedback={setFeedback} onRoutingStatusChange={handleRoutingStatusChange} /> : null}
    </section>
  );
}
