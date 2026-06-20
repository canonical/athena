# Event Source Implementation Plan

## Goal

Deliver Athena event sources in a dependency-safe order that validates deterministic loop behavior early and adds external integrations incrementally.

## Recommended implementation order

1. User request
2. Tool execution event source
3. Webhook event
4. Scheduler event
5. System event
6. Manual override event

## Why this order

- User request is the smallest end-to-end path to validate event creation, routing, assignment, and completion or blocked handoff.
- Tool execution builds on the same flow and validates traceability and validation controls without external inbound complexity.
- Webhook adds external verification, replay protection, and idempotency after core loop behavior is stable.
- Scheduler and system events are internal automation sources that are easier to add once event semantics are proven.
- Manual override is highest-risk operational control and should be added after baseline governance and audit paths are mature.

## Phase plan

### Phase 1: Core loop baseline

Detailed plan: [event-source.phase1.plan.md](./event-source.phase1.plan.md)

### Phase 2: Internal execution evidence

Detailed plan: [event-source.phase2.plan.md](./event-source.phase2.plan.md)

### Phase 3: External inbound events

Detailed plan: [event-source.phase3.plan.md](./event-source.phase3.plan.md)

### Phase 4: Automation and operations

Detailed plan: [event-source.phase4.plan.md](./event-source.phase4.plan.md)

## Cross references

- Event model and source list: [event.md](./event.md)
- Loop routing semantics: [theloop.md](./theloop.md)
- Handoff protocol: [handoff.definition.md](./handoff.definition.md)
- Tool semantics: [tool-usage.md](./tool-usage.md)
- NFR constraints: [nfr.md](./nfr.md)
