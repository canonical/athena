# Event Definition

## Event Entity

An Event is the first-class unit of work within Athena orchestration. Events provide context to assigned personas (typically LLM agents) to perform work.

- Events are emitted into an existing loop.
- Each event belongs to exactly one loop.
- Events capture ownership, status, and execution context.
- Events do not have steps; if additional work is needed, new events are created.
- Events can refer to each other to represent dependencies or sequencing relationships.

## Required Event Information

Each event must include:

- context information (goals, constraints, and scope for the work to be performed)
- assigned persona
- event type
- current status
- relevant blockers and approvals

## Event Outcomes

When a persona finishes processing an event, the event reaches one of two outcomes:

- `completed`: The persona has finished the work and no further action is needed for that event.
- `blocked`: The persona encountered a blocker and the event is handed back to the engineering manager persona for resolution.

Event outcomes do not create new events. A completed or blocked event ends the persona's responsibility for that event but does not close the loop. Loops do not have outcomes; events do.

## Event Sources

1. User request
2. Agent event
3. Jira event (optional, only when Jira ingestion is configured for the loop)
4. GitHub event
5. Tool execution event
6. Scheduler event
7. System event
8. Manual override event
