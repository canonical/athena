import { MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useLoopEvents } from "./loop.query.js";

const statusLabel: Record<string, string> = {
  created: "Created",
  routed: "Routed",
  completed: "Completed",
  blocked: "Blocked",
};

export function Loop() {
  const state = useLoopEvents();

  if (state.status === "loading") {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Loop</p>
        <p className="p-text--default">Loading events...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Loop</p>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop events">
          {state.message}
        </Notification>
      </section>
    );
  }

  return (
    <section className="athena-home">
      <p className="p-heading--5">Loop</p>
      <h1 className="p-heading--2">Loop events</h1>
      {state.events.length === 0 ? (
        <p className="p-text--default">No loop events yet. Submit a loop request to get started.</p>
      ) : (
        <MainTable
          headers={[
            { content: "Status" },
            { content: "Source" },
            { content: "Work item" },
            { content: "Requested outcome" },
            { content: "Assignee" },
            { content: "Emitted at" },
          ]}
          rows={state.events.map((event) => ({
            key: event.id,
            columns: [
              { content: statusLabel[event.status] ?? event.status },
              { content: event.sourceRef ? `${event.sourceType} · ${event.sourceRef}` : event.sourceType },
              {
                content: event.workItemUrl ? (
                  <a href={event.workItemUrl} rel="noreferrer" target="_blank">
                    {event.workItemUrl}
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
