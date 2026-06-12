import { MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEvents } from "./event.query.js";
import type { EventPayload } from "./event.schema.js";

const statusLabel: Record<string, string> = {
  created: "Created",
  routed: "Routed",
  completed: "Completed",
  blocked: "Blocked",
};

const isRecord = (value: unknown): value is EventPayload => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readEventUrl = (payload: EventPayload): string | undefined => {
  const directUrl = payload.workItemUrl ?? payload.topLevelWorkItemUrl ?? payload.url;

  if (typeof directUrl === "string" && directUrl.trim().length > 0) {
    return directUrl;
  }

  const source = payload.source;

  if (!isRecord(source)) {
    return undefined;
  }

  const sourceUrl = source.workItemUrl ?? source.topLevelWorkItemUrl ?? source.url;

  return typeof sourceUrl === "string" && sourceUrl.trim().length > 0 ? sourceUrl : undefined;
};

export function Event() {
  const state = useEvents();

  if (state.status === "loading") {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Events</p>
        <p className="p-text--default">Loading events...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Events</p>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load events">
          {state.message}
        </Notification>
      </section>
    );
  }

  return (
    <section className="athena-home">
      <p className="p-heading--5">Events</p>
      <h1 className="p-heading--2">Events</h1>
      {state.events.length === 0 ? (
        <p className="p-text--default">No events yet. Submit an event to get started.</p>
      ) : (
        <MainTable
          headers={[{ content: "Status" }, { content: "Source" }, { content: "Work item" }, { content: "Requested outcome" }, { content: "Assignee" }, { content: "Emitted at" }]}
          rows={state.events.map((event) => ({
            key: event.id,
            columns: [
              { content: statusLabel[event.status] ?? event.status },
              { content: event.sourceRef ? `${event.sourceType} · ${event.sourceRef}` : event.sourceType },
              {
                content: readEventUrl(event.payload) ? (
                  <a href={readEventUrl(event.payload)} rel="noreferrer" target="_blank">
                    {readEventUrl(event.payload)}
                  </a>
                ) : (
                  "—"
                ),
              },
              { content: event.requestedOutcome ?? "—" },
              { content: event.assignee ?? "—" },
              { content: new Date(event.emittedAt).toLocaleString() },
            ],
          }))}
        />
      )}
    </section>
  );
}
