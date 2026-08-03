import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useFeedbackToast } from "@components/base/toast.js";
import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { usePersonaList } from "../persona/persona.query.js";
import { useLoop } from "./loop.query.js";
import type { Feedback, LoopProps, Tab } from "./loop.schema.js";

const LazyLoopDashboard = lazy(async () => {
  const module = await import("./LoopDashboard.js");

  return { default: module.LoopDashboard };
});

const LazyLoopDetails = lazy(async () => {
  const module = await import("./LoopDetails.js");

  return { default: module.LoopDetails };
});

const LazyLoopPersonas = lazy(async () => {
  const module = await import("./LoopPersonas.js");

  return { default: module.LoopPersonas };
});

const LazyLoopProviders = lazy(async () => {
  const module = await import("./LoopProviders.js");

  return { default: module.LoopProviders };
});

const LazyLoopRunners = lazy(async () => {
  const module = await import("./LoopRunners.js");

  return { default: module.LoopRunners };
});

export function Loop({ loopId, tab, editor, personaId }: LoopProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const { state: personaListState, reload: reloadPersonaList } = usePersonaList(loopId);
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

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
      <nav aria-label="Loop sections" className="p-tabs">
        <div role="tablist">
          <ul className="p-tabs__list">
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `dashboard`} className={`p-tabs__link${tab === `dashboard` ? ` is-active` : ``}`} onClick={() => setTab(`dashboard`)} role="tab" type="button">
                Dashboard
              </button>
            </li>
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
              <button aria-selected={tab === `runners`} className={`p-tabs__link${tab === `runners` ? ` is-active` : ``}`} onClick={() => setTab(`runners`)} role="tab" type="button">
                Runners
              </button>
            </li>
          </ul>
        </div>
      </nav>
      {tab === `dashboard` ? (
        <Suspense fallback={<div>Loading dashboard...</div>}>
          <LazyLoopDashboard loopId={loopId} />
        </Suspense>
      ) : null}
      {tab === `details` ? (
        <Suspense fallback={<div>Loading details...</div>}>
          <LazyLoopDetails loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} onFeedback={setFeedback} onSaved={reloadLoop} />
        </Suspense>
      ) : null}
      {tab === `personas` ? (
        <Suspense fallback={<div>Loading personas...</div>}>
          <LazyLoopPersonas editor={editor} loopId={loopId} onFeedback={setFeedback} personaId={personaId} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
        </Suspense>
      ) : null}
      {tab === `providers` ? (
        <Suspense fallback={<div>Loading providers...</div>}>
          <LazyLoopProviders loopId={loopId} onFeedback={setFeedback} />
        </Suspense>
      ) : null}
      {tab === `runners` ? (
        <Suspense fallback={<div>Loading runners...</div>}>
          <LazyLoopRunners loopId={loopId} onFeedback={setFeedback} />
        </Suspense>
      ) : null}
    </section>
  );
}
