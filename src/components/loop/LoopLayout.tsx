import { Notification, NotificationSeverity } from "@canonical/react-components";
import { useFeedbackToast } from "@components/base/toast.js";
import { Outlet } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePersonaList } from "../persona/persona.query.js";
import { LoopContext } from "./loop.context.js";
import { useLoop } from "./loop.query.js";
import type { Feedback } from "./loop.schema.js";

export function LoopLayout({ loopId }: Readonly<{ loopId: string }>) {
  const { state: loopState, reload: reloadLoop } = useLoop(loopId);
  const { state: personaListState, reload: reloadPersonaList } = usePersonaList(loopId);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const loop = loopState.status === `success` ? loopState.loop : null;
  let personaListStateKey: unknown = null;
  if (personaListState.status === `success`) {
    personaListStateKey = personaListState.personas;
  } else if (personaListState.status === `error`) {
    personaListStateKey = personaListState.message;
  }
  const contextValue = useMemo(() => (loop === null ? null : { loop, reloadLoop, personaListState, reloadPersonaList, onFeedback: setFeedback }), [loop, reloadLoop, personaListState.status, personaListStateKey, reloadPersonaList]);

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

  const activeRoutingCount = personaListState.status === `success` ? personaListState.personas.filter((persona) => persona.isRouting && persona.lifecycleStatus === `active`).length : null;
  let routingPausedMessage: string | null = null;
  if (activeRoutingCount === 0) {
    routingPausedMessage = `This loop has no active routing persona and is paused. Go to the Personas tab and assign or activate a routing persona.`;
  } else if (activeRoutingCount !== null && activeRoutingCount > 1) {
    routingPausedMessage = `This loop has ${activeRoutingCount} active routing personas and is paused. Exactly one is required. Go to the Personas tab and remove or archive the extras.`;
  }

  if (contextValue === null) {
    return null;
  }

  return (
    <LoopContext.Provider value={contextValue}>
      <div className="u-no-max-width">
        {routingPausedMessage ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Loop is paused">
            {routingPausedMessage}
          </Notification>
        ) : null}
        <Outlet />
      </div>
    </LoopContext.Provider>
  );
}
