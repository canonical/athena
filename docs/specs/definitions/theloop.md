# The Loop

Athena is the deterministic orchestration system. The loop describes the deterministic processes Athena executes as it routes events through personas and manages their outcomes.

Athena routes each event to the engineering manager persona, and the engineering manager persona decides the next assigned persona for execution.

Only the engineering manager persona can push an event to the loop with an assigned persona.

For each routing decision, Athena deterministically feeds the engineering manager persona with the loop's persisted persona roster and the corresponding persona definition context defined in [persona.md](./persona.md).

1. When an event is created with no assigned persona, Athena asks the engineering manager persona for an assignment.

   Personas:
   - Engineering manager persona

   Files:
   - [responsibility.rules.md](./responsibility.rules.md)
   - [interaction.protocol.md](./interaction.protocol.md)
   - [handoff.definition.md](./handoff.definition.md)
   - [approval.matrix.md](./approval.matrix.md)

2. Athena routes the event with its context to the assigned persona. The persona processes the event, and either a new event is emitted for another persona, or the event is marked as completed and the user is notified.

   Personas:
   - Assigned persona

   Files:
   - [responsibility.rules.md](./responsibility.rules.md)
   - [interaction.protocol.md](./interaction.protocol.md)
   - [handoff.definition.md](./handoff.definition.md)

3. Event entity requirements are defined in [event.md](./event.md).

4. If a persona cannot complete an event due to ambiguity, dependency, missing approval, or other blockers, it performs a blocked handoff back to the loop. Athena then routes the returned event to the engineering manager persona. See the blocked handoff protocol in [handoff.definition.md](./handoff.definition.md).

   Personas:
   - Assigned persona
   - Engineering manager persona

   Files:
   - [handoff.definition.md](./handoff.definition.md)

5. When an event is marked as completed, it means the assigned persona has finished processing the event and no more work is required from that persona for that event.

   Personas:
   - Assigned persona

   Files:
   - [responsibility.rules.md](./responsibility.rules.md)
   - [handoff.definition.md](./handoff.definition.md)

6. A completion or blocked event concludes only the current step. The loop itself remains available for future events and follow-up work.

   Personas:
   - Engineering manager persona

   Files:
   - [interaction.protocol.md](./interaction.protocol.md)
   - [handoff.definition.md](./handoff.definition.md)

## Loops

A loop and user relationship is many-to-many. A user can belong to multiple loops, and a loop can include multiple users. Each loop groups the events that belong to an ongoing work context.

Every loop must include exactly one engineering manager persona. The engineering manager persona is the required fallback owner for blocked events and unresolved ownership decisions. Users can edit the engineering manager persona, but they cannot create or delete it.

- A loop has a human-readable name and an optional description to identify the work context.
- Loop-user membership is represented through the `loopUser` junction relation.
- The user who creates a loop becomes an admin member of that loop.
- Loop admins configure the loop's coding harness priority list and OpenAI API-compatible LLM provider priority list as defined in [llm-harness.md](./llm-harness.md).
- If all configured providers for required execution are unavailable, Athena pauses loop execution and resumes automatically after deterministic availability checks detect provider recovery.
- Provider-unavailability pauses do not close loop events; events remain open until normal execution can resume.
- Listing loops for a user returns the loops they belong to.
- Loops are long-lived. They stay available after events are completed or blocked.

## Event Reference

Event entity semantics, required fields, outcomes, and sources are defined in [event.md](./event.md).
