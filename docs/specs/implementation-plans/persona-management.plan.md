# Persona Management Implementation Plan

## Objective

Define persona schema, lifecycle, and capability model for IC, CR, EM, PM, QA, and UX personas within Athena's loop orchestration.

Each persona is an orchestration role that performs a specific function in a loop's event handling and decision-making. Personas must be defined before loops can be configured, since loops assign personas to execute work.

## Scope

- Persona definition schema (role, capabilities, constraints)
- Persona lifecycle (active, deprecated, archived)
- Loop-scoped persona assignment model
- Predefined persona set (IC, CR, EM, PM, QA, UX)
- Persona audit trail

## Persona catalog (predefined set)

1. **IC (Individual Contributor)** — Executes implementation work (coding, tool execution) via harness. Routes events to CR for review.
2. **CR (Code Reviewer)** — Reviews IC outputs, approves, requests changes, or escalates. Can assign events back to IC or forward to EM.
3. **EM (Engineering Manager)** — Handles escalations, overrides, and loop governance decisions. Can pause/resume loops or assign to other personas.
4. **PM (Product Manager)** — Defines acceptance criteria and loop goals; provides context for IC/CR decisions.
5. **QA (Quality Assurance)** — Validates outputs against acceptance criteria; can send events back to IC or approve for release.
6. **UX (User Experience)** — Provides user-facing guidance; can reject outputs that violate UX constraints.

## Loop-scoped persona assignment

### What a loop admin configures

For each loop, the admin selects:

1. Which personas are active/enabled (e.g., IC, CR, EM are required; QA and UX are optional).
2. For each enabled persona: credential reference (if needed for external integrations), timeout/backoff settings.
3. Persona routing policy (default ordering for escalations and handoffs).

### Persona execution model

1. Each loop event is assigned to exactly one active persona at a time.
2. A persona processes the event, makes a decision (approve, request changes, escalate, etc.), and may route to another persona.
3. Routing decisions are deterministic based on loop policy and persona capability constraints.
4. All persona assignments and transitions are recorded in the event audit trail.

## Persona definition schema

```
{
  "id": "uuidv7",
  "displayName": "string (e.g., 'Individual Contributor')",
  "personality": "string (persona description and responsibilities)",
  "usesCodingHarness": boolean,
  "isDecisionMaker": boolean,
  "lifecycleStatus": "string (active, deprecated, archived)"
}
```

## Validation and safety gates

1. At least one EM persona must be enabled in any loop.
2. At least one persona with `usesCodingHarness: true` must be enabled in any loop.
3. Persona routing must be acyclic (no infinite handoff loops).
4. If `isDecisionMaker` is true, `usesCodingHarness` must be false.
5. If a persona has `usesCodingHarness: true`, a harness must be available before assignment.

## Observability and auditability

Every persona assignment and transition must capture:

1. `loopId`
2. `eventId`
3. `fromPersona` (or null if initial assignment)
4. `toPersona`
5. `decision` (approve, reject, escalate, override, etc.)
6. `reason` (optional context)
7. timestamp
8. actor (if manual override, who initiated)

Persona profile create/update/delete actions must audit: actor, loop ID, change summary, before/after snapshot.

## Implementation steps

1. Define canonical persona catalog in [personas/index.md](../personas/index.md) with schema and all reference personas (IC, CR, EM, PM, QA, UX).
2. Create loop admin UI/API for enabling personas and configuring routing policy per loop.
3. **UI recommendation**: Display all reference personas as suggestions when admins configure a loop; allow admins to select, enable/disable, or create custom personas.
4. Implement persona lookup and validation at loop initialization time.
5. Implement persona router: deterministic assignment based on event type and loop policy.
6. Integrate persona assignment into event audit trail; record all persona transitions.
7. Add persona profile CRUD (create, list, update, delete) with full audit logging.
8. Add integration tests: valid/invalid persona configurations (EM required, at least one coding harness), routing policy validation, acyclic constraint enforcement.

## Acceptance criteria

1. Loop admins can configure persona profiles (enabled, disabled, routing priority).
2. Minimum requirement: one EM persona and at least one coding-harness persona enabled.
3. UI recommends all reference personas (IC, CR, EM, PM, QA, UX) as templates.
4. Persona routing is deterministic: same loop configuration always routes to the same persona under identical event conditions.
5. Persona transitions are fully audited with decision reason and actor (if manual).
6. Invalid persona configurations (missing EM, no coding harness, cyclic routing) are rejected at save time with clear error messages.
7. All persona assignment decisions visible in event audit trail with transitions and decision reasoning.