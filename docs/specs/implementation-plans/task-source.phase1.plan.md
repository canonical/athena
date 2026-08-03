# Task Source Phase 1 Plan — Core Loop Baseline

## Scope

- Implement User request task source.
- Verify deterministic routing through engineering manager persona.
- Verify task outcomes and blocked handoff behavior.

## Deliverables

1. User message ingestion path that creates a loop task.
2. Routing integration from unassigned task to engineering manager persona.
3. Outcome handling for `completed` and `blocked`.
4. Audit records for task creation, routing, and outcome transitions.

## Done when

- User message creates a loop task and routes correctly.
- Task handling remains deterministic under retry.
- Blocked handoff returns the task to the engineering manager path.

## References

- [user-request.md](../definitions/user-request.md)
- [task.md](../definitions/task.md)
- [theloop.md](../definitions/theloop.md)
- [handoff.definition.md](../definitions/handoff.definition.md)
- [nfr.md](../definitions/nfr.md)
