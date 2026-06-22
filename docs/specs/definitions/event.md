# Event Definition

## Event Entity

An Event is the first-class unit of work within Athena orchestration. Events provide context to assigned personas (typically LLM agents) to perform work.

- Events are emitted into an existing loop.
- Each event belongs to exactly one loop.
- Events capture ownership, status, and execution context.
- Events can be edited after creation to update context, status, blockers, or approvals.
- Events do not have steps; if additional work is needed, new events are created.
- Events can refer to each other to represent dependencies or sequencing relationships.
- In the chat UI, each user message and each engineering manager response is backed by an event. Internal events spawned by the engineering manager to consult other personas are not surfaced in the chat UI.

## Required Event Information

Each event must include:

- context information (goals, constraints, and scope for the work to be performed)
- assigned persona (set only when the engineering manager persona pushes an assigned event to the loop)
- event type
- current status
- relevant blockers and approvals

In horizontally scaled execution, event lifecycle operations must be deterministic and concurrency-safe:

- Event status mutation must use atomic write semantics with concurrency protection.
- Duplicate execution attempts for the same event must be safely ignored or collapsed through idempotency controls.
- Observed final event outcome must not depend on which Athena instance processed the winning execution attempt.

## Event Outcomes

When a persona finishes processing an event, the event reaches one of two outcomes:

- `completed`: The persona has finished the work and no further action is needed for that event.
- `blocked`: The persona encountered a blocker and the event is handed back to the loop, then routed by Athena to the engineering manager persona for resolution.

Event outcomes do not create new events. A completed or blocked event ends the persona's responsibility for that event but does not close the loop. Loops do not have outcomes; events do.

Provider or harness unavailability is not an event outcome by itself. Athena must not auto-complete or auto-block events solely due to provider outage.

## Possible Event Sources (MVP)

1. [User request](./user-request.md)
2. Agent event
3. [Webhook event](./webhook-event.md)
4. [Tool execution event](./tool-usage.md)
5. Scheduler event
6. System event
7. Manual override event

### Tool execution event source

When tool usage is represented as an event source, the source payload must identify the originating event and include a tool execution record as defined in [tool-usage.md](./tool-usage.md).

- Tool execution events are evidence-bearing context updates.
- Tool execution events do not transfer ownership on their own.
- If tool execution creates ambiguity or blockers, Athena routes through the engineering manager persona according to [theloop.md](./theloop.md).
