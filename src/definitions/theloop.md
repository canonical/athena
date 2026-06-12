# The Loop

1. When an event is created with no assigned persona, Athena asks the engineering manager persona for an assignment.
  Personas:
  - Engineering manager persona
  Files:
  - responsibility.rules.md
  - interaction.protocol.md
  - handoff.definition.md
  - approval.matrix.md

2. Athena routes the event to the assigned persona together with the active Jira item and the required context. At the end of the step, either a new event is emitted for another persona, or a completion event is emitted. Completion events notify the user.
  Personas:
  - Assigned persona
  Files:
  - responsibility.rules.md
  - interaction.protocol.md
  - handoff.definition.md
  - jira.dod.md

3. Each event must include the active Jira item, the assigned persona, the event type, the current status, and any relevant blockers or approvals.

4. If a persona cannot continue because of ambiguity, dependency, or missing approval, Athena emits a blocked event and routes it through the engineering manager persona. If the engineering manager persona cannot resolve the block, Athena notifies the user.
  Personas:
  - Assigned persona
  - Engineering manager persona
  Files:
  - interaction.protocol.md
  - handoff.definition.md

5. A completion event means the assigned persona has finished its current responsibility for the active Jira item and no more work is required from that persona for that step.
  Personas:
  - Assigned persona
  Files:
  - responsibility.rules.md
  - handoff.definition.md

6. A completion or blocked event concludes only the current step. The loop itself remains available for future events and follow-up work.
  Personas:
  - Engineering manager persona
  Files:
  - interaction.protocol.md
  - handoff.definition.md

## Loops

A user can belong to multiple loops. Each loop groups the events that belong to an ongoing work context.

- A loop has a human-readable name and an optional description to identify the work context.
- A loop can belong to multiple users through loop membership.
- Listing loops for a user returns the loops they belong to.
- Loops are long-lived. They stay available after events are completed or blocked.

## Events

Events are the first-class unit of work within a loop. Each event records a discrete step in the orchestration process.

- Events are emitted into an existing loop.
- Each event belongs to exactly one loop.
- Events have outcomes: an event concludes as `completed` or `blocked`.
- A completed or blocked event does not close the loop; later events may still be emitted on the same loop.
- Loops do not have outcomes; events do.

## Event Sources

1. User request
2. Jira event
3. Agent event
4. GitHub event
5. Tool execution event
6. Scheduler event
7. System event
8. Manual override event
