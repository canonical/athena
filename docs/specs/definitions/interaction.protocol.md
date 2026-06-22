# Interaction Protocol

The engineering manager persona is a required participant in every loop and serves as the ultimate resolver of blockers and ownership ambiguity.

Personas used by the loop are persisted in the database per loop, not loaded from flat files. See [persona.md](./persona.md).

1. The engineering manager persona routes work and resolves who should act next when ownership is unclear.
2. Only the engineering manager persona can push an event to the loop with an assigned persona.
3. Athena deterministically provides the engineering manager persona with the loop's persisted persona roster and persona definition context from [persona.md](./persona.md) for routing decisions.
4. The user is the approval authority for scope and content changes unless a definition states otherwise.
5. Only one persona should actively own a piece of work (event) at a time.
6. Every persona-to-persona transition must use the handoff definition.
7. When a persona is blocked by ambiguity, dependency, or missing approval, it performs a blocked handoff back to the loop using the blocked handoff protocol in [handoff.definition.md](./handoff.definition.md). Athena then naturally routes the returned event, with its improved context, to the engineering manager persona.
8. Discussions should stay attached to the active work context whenever possible.
