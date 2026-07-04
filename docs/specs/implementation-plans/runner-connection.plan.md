# Runner Connection Contract Plan

## Objective

Define owner-scoped runner definitions, loop assignments, and deterministic runner key selection within Athena's routing model.

## Scope

- Owner-scoped runner definition schema
- Loop assignment lifecycle and permissions
- Deterministic assignment ordering
- MVP execution constraint (GitHub Copilot Cloud only)
- Multi-key selection algorithms
- Fallback and unavailability behavior

## Runner catalog

Runners are execution environments that host harnesses. See [runner-harness.md](../definitions/runner-harness.md) for normative definitions and the proprietary vs open runner distinction.

| Runner | Type | Identifier | Status |
|---|---|---|---|
| GitHub Copilot Cloud | Proprietary | `github-copilot-cloud` | MVP — only executable runner |
| Juju VM | Open (Athena-owned) | `juju-vm` | Post-MVP — Athena-owned implementation target |
| Local Ubuntu binary | Open (user-managed) | `local-ubuntu` | Post-MVP — disposable VMs encouraged, local machines discouraged |

## Runner definition and assignment contract

### Definition ownership

1. Runner definitions are independent records and are not loop-scoped.
2. Definitions are owner-scoped resources.
3. Owners can create, read, update, and delete their own definitions.
4. Credentials are entered directly and stored as encrypted envelopes.

### Loop assignment permissions

1. Users assign one or more runner definitions to loops through many-to-many assignment records.
2. Loop members can assign definitions.
3. Priority ordering and assignment overrides are editable by loop admins only.

### Deterministic runner selection

When a runner-backed persona executes:

1. Evaluate enabled assigned runner definitions in deterministic order.
2. Apply configured loop selection algorithm for the Copilot pool.
3. On unavailability/failure, use deterministic fallback policy.
4. Persist selected assignment ID and skip reasons in execution metadata.

### MVP execution constraint

1. In MVP, `github-copilot-cloud` is the only available runner type. No other runner type can be selected or configured.
2. Execution-time selection skips any non-compliant entries with a recorded reason.

## Validation and safety gates

1. At least one enabled runner assignment must exist before runner-backed execution.
2. Priority order must be unique and deterministic per loop.
3. Timeout and retry values are bounded by deterministic limits.
4. Assignment overrides are mutable only by loop admins.
5. Selection must record deterministic tie-breakers and fallback reason.

## Implementation steps

1. Add owner-scoped runner definition persistence with encrypted credential envelope fields.
2. Add loop assignment table with priority, overrides, timeout/retry, and runtime metrics.
3. Implement owner-only definition CRUD.
4. Implement member assignment CRUD and admin-only ordering/override mutation.
5. Implement deterministic selection algorithms and fallback policy for Copilot pool.
6. Add execution-time hook to resolve selected runner key.
7. Add E2E tests for permissions, deterministic ordering, MVP enforcement, and redaction.

## Acceptance criteria

1. Owners can manage runner definitions independent of loops.
2. Loop members can assign runner definitions; only admins can edit order/overrides.
3. MVP constraint is enforced at execution-time.
4. Runner selection is deterministic.
5. Secret material is never exposed via API responses or logs.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [runner-harness.md](../definitions/runner-harness.md)
- [theloop.md](../definitions/theloop.md)
- [event.md](../definitions/event.md)
- [nfr.md](../definitions/nfr.md)
