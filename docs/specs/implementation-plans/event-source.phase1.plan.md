# Event Source Phase 1 Plan — Core Loop Baseline

## Scope

- Implement User request event source.
- Verify deterministic routing through engineering manager persona.
- Verify event outcomes and blocked handoff behavior.

## Deliverables

1. User message ingestion path that creates a loop event.
2. Routing integration from unassigned event to engineering manager persona.
3. Outcome handling for `completed` and `blocked`.
4. Audit records for event creation, routing, and outcome transitions.

## Done when

- User message creates a loop event and routes correctly.
- Event handling remains deterministic under retry.
- Blocked handoff returns the event to the engineering manager path.

## References

- [user-request.md](../definitions/user-request.md)
- [event.md](../definitions/event.md)
- [theloop.md](../definitions/theloop.md)
- [handoff.definition.md](../definitions/handoff.definition.md)
- [nfr.md](../definitions/nfr.md)
