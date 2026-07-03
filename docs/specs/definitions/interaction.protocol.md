# Interaction Protocol

The active routing persona is a required participant in every loop and serves as the ultimate resolver of blockers and ownership ambiguity.

In current Athena definitions, the engineering manager persona is the required routing persona for each loop.

Personas used by the loop are persisted in the database per loop, not loaded from flat files. See [persona.md](./persona.md).

1. The active routing persona routes work and resolves who should act next when ownership is unclear.
2. Only the active routing persona can push an event to the loop with an assigned persona.
3. Athena deterministically provides the active routing persona with the loop's persisted persona roster and persona definition context from [persona.md](./persona.md) for routing decisions.
4. For each event step, the active routing persona selects the execution environment (harness-backed path or deterministic Athena thread path) under [llm-harness.md](./llm-harness.md).
5. The user is the approval authority for scope and content changes unless a definition states otherwise.
6. Only one persona should actively own a piece of work (event) at a time.
7. Every persona-to-persona transition must use the handoff definition.
8. When a persona is blocked by ambiguity, dependency, or missing approval, it performs a blocked handoff back to the loop using the blocked handoff protocol in [handoff.definition.md](./handoff.definition.md). Athena then naturally routes the returned event, with its improved context, to the active routing persona.
9. Discussions should stay attached to the active work context whenever possible.
