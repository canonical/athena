# The Loop

Athena is the deterministic orchestration system. The loop describes the deterministic processes Athena executes as it routes events through personas and manages their outcomes.

Athena routes each event to the engineering manager persona, and the engineering manager persona decides the next assigned persona for execution.

1. When an event is created with no assigned persona, Athena asks the engineering manager persona for an assignment.

   Personas:
   - Engineering manager persona

   Files:
   - responsibility.rules.md
   - interaction.protocol.md
   - handoff.definition.md
   - approval.matrix.md

2. Athena routes the event with its context to the assigned persona. The persona processes the event, and either a new event is emitted for another persona, or the event is marked as completed and the user is notified.

   Personas:
   - Assigned persona

   Files:
   - responsibility.rules.md
   - interaction.protocol.md
   - handoff.definition.md

3. Event entity requirements are defined in `event.md`.

4. If a persona cannot complete an event due to ambiguity, dependency, missing approval, or other blockers, it performs a blocked handoff back to the engineering manager persona. See the blocked handoff protocol in `handoff.definition.md`.

   Personas:
   - Assigned persona
   - Engineering manager persona

   Files:
   - handoff.definition.md

5. When an event is marked as completed, it means the assigned persona has finished processing the event and no more work is required from that persona for that event.

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

A loop and user relationship is many-to-many. A user can belong to multiple loops, and a loop can include multiple users. Each loop groups the events that belong to an ongoing work context.

Every loop must include an engineering manager persona. The engineering manager persona is the required fallback owner for blocked events and unresolved ownership decisions. Users can customize or replace their engineering manager persona implementation, but each loop must always have one.

- A loop has a human-readable name and an optional description to identify the work context.
- Loop-user membership is represented through the `loopUser` junction relation.
- The user who creates a loop becomes an admin member of that loop.
- Listing loops for a user returns the loops they belong to.
- Loops are long-lived. They stay available after events are completed or blocked.

## Event Reference

Event entity semantics, required fields, outcomes, and sources are defined in `event.md`.
