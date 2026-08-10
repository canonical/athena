import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useFeedbackToast } from "@components/base/toast.js";
import { lazy, Suspense, useState } from "react";
import { usePersonaList } from "../persona/persona.query.js";
import { useLoop } from "./loop.query.js";
import type { Feedback, LoopProps } from "./loop.schema.js";

const LazyTaskList = lazy(async () => {
  const module = await import("@components/task/TaskList.js");

  return { default: module.TaskList };
});

const LazyLoopDetails = lazy(async () => {
  const module = await import("./LoopDetails");

  return { default: module.LoopDetails };
});

const LazyLoopTools = lazy(async () => {
  const module = await import("@components/tool/LoopTools.js");

  return { default: module.LoopTools };
});

const LazyLoopPersonas = lazy(async () => {
  const module = await import("./LoopPersonas");

  return { default: module.LoopPersonas };
});

const LazyLoopMembers = lazy(async () => {
  const module = await import("./LoopMembers");

  return { default: module.LoopMembers };
});

const LazyLoopProviders = lazy(async () => {
  const module = await import("./LoopProviders");

  return { default: module.LoopProviders };
});

const LazyLoopRunners = lazy(async () => {
  const module = await import("./LoopRunners");

  return { default: module.LoopRunners };
});

const LazyLoopWorkgraphs = lazy(async () => {
  const module = await import("./LoopWorkgraphs");

  return { default: module.LoopWorkgraphs };
});

const LazyLoopRepositories = lazy(async () => {
  const module = await import("./LoopRepositories");

  return { default: module.LoopRepositories };
});

export function Loop({ loopId, tab, editor, personaId, workgraphViewWorkgraphId, workgraphConfigTab }: LoopProps) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const { state: personaListState, reload: reloadPersonaList } = usePersonaList(loopId);
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
    <>
      {routingPausedMessage ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Loop is paused">
          {routingPausedMessage}
        </Notification>
      ) : null}
      {tab === `tasks` ? (
        <Suspense fallback={<div>Loading tasks...</div>}>
          <LazyTaskList loopId={loopId} />
        </Suspense>
      ) : null}
      {tab === `details` ? (
        <Suspense fallback={<div>Loading details...</div>}>
          <LazyLoopDetails loopId={loopId} loopName={loop?.name ?? ``} loopDescription={loop?.description ?? ``} loopIterationCostLimitUsd={loop?.iterationCostLimitUsd ?? null} onFeedback={setFeedback} onSaved={reloadLoop} />
        </Suspense>
      ) : null}
      {tab === `tools` ? (
        <Suspense fallback={<div>Loading tools...</div>}>
          <LazyLoopTools loopId={loopId} onFeedback={setFeedback} />
        </Suspense>
      ) : null}
      {tab === `personas` ? (
        <Suspense fallback={<div>Loading personas...</div>}>
          <LazyLoopPersonas editor={editor} loopId={loopId} onFeedback={setFeedback} personaId={personaId} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
        </Suspense>
      ) : null}
      {tab === `members` ? (
        <Suspense fallback={<div>Loading members...</div>}>
          <LazyLoopMembers loopId={loopId} onFeedback={setFeedback} />
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
      {tab === `workgraphs` ? (
        <Suspense fallback={<div>Loading workgraphs...</div>}>
          <LazyLoopWorkgraphs loopId={loopId} onFeedback={setFeedback} workgraphViewWorkgraphId={workgraphViewWorkgraphId} workgraphConfigTab={workgraphConfigTab} />
        </Suspense>
      ) : null}
      {tab === `repositories` ? (
        <Suspense fallback={<div>Loading repositories...</div>}>
          <LazyLoopRepositories loopId={loopId} onFeedback={setFeedback} />
        </Suspense>
      ) : null}
    </>
  );
}
