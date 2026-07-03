# Harness Connection Contract Plan

## Objective

Define owner-scoped harness definitions, loop assignments, and deterministic harness key selection for IC and CR personas within Athena's routing model.

## Scope

- Owner-scoped harness definition schema
- Loop assignment lifecycle and permissions
- Deterministic assignment ordering
- MVP execution constraint (GitHub Copilot Cloud Agent only)
- Multi-key selection algorithms
- Fallback and unavailability behavior
- Audit trail for assignment and selection outcomes

## Runner and harness catalog

Runners are execution environments that host harnesses. Harnesses are the AI coding agent tools that run within runners. See [worker.md](../definitions/worker.md) for normative definitions.

1. **GitHub Copilot Cloud** (`github-copilot-cloud`) — MVP executable runner; required for harness-backed execution in Phase 1. Hosts the GitHub Copilot coding agent.
2. **Juju VM** (`juju-vm`) — MVP+1 Athena-owned runner target; can host multiple harness types (OpenCode, Claude Code, Codex, etc.).
3. **OpenAI Codex** — Post-MVP harness candidate (requires a compatible runner).
4. **Claude Code** — Post-MVP harness candidate (requires a compatible runner).
5. **Devin** — Post-MVP candidate; fully managed vendor platform (runner + harness combined).

## Harness definition and assignment contract

### Definition ownership

1. Harness definitions are independent records and are not loop-scoped.
2. Definitions are owner-scoped resources.
3. Owners can create, read, update, and delete their own definitions.
4. Credentials are entered directly and stored as encrypted envelopes.

### Loop assignment permissions

1. Users assign one or more harness definitions to loops through many-to-many assignment records.
2. Loop members can assign definitions.
3. Priority ordering and assignment overrides are editable by loop admins only.

### Deterministic harness selection

When a harness-backed persona executes:

1. Evaluate enabled assigned harness definitions in deterministic order.
2. Apply configured loop selection algorithm for the Copilot pool.
3. On unavailability/failure, use deterministic fallback policy.
4. Persist selected assignment ID and skip reasons in execution metadata.

### MVP execution constraint

1. In MVP, the only executable runner is `github-copilot-cloud`.
2. Harness definitions targeting other runner types are rejected at save time.
3. Execution-time selection re-enforces the MVP rule and skips non-compliant entries with audit reason.

## Validation and safety gates

1. At least one enabled harness assignment must exist before harness-backed execution.
2. Priority order must be unique and deterministic per loop.
3. Timeout and retry values are bounded by deterministic limits.
4. Assignment overrides are mutable only by loop admins.
5. Selection must record deterministic tie-breakers and fallback reason.

## Observability and auditability

Every harness selection attempt captures:

1. `loopId`
2. `selectedAssignmentId` (or null)
3. `algorithmRequested`
4. `algorithmUsed`
5. `fallbackReason`
6. `skipped[]` with assignment ID and reason
7. timestamp

Definition and assignment lifecycle updates must audit actor, target ID, and before/after snapshots with secret redaction.

## Implementation steps

1. Add owner-scoped harness definition persistence with encrypted credential envelope fields.
2. Add loop assignment table with priority, overrides, timeout/retry, and runtime metrics.
3. Implement owner-only definition CRUD.
4. Implement member assignment CRUD and admin-only ordering/override mutation.
5. Implement deterministic selection algorithms and fallback policy for Copilot pool.
6. Add execution-time hook to resolve selected harness key and record audit metadata.
7. Add E2E tests for permissions, deterministic ordering, MVP enforcement, and redaction.

## Acceptance criteria

1. Owners can manage harness definitions independent of loops.
2. Loop members can assign harness definitions; only admins can edit order/overrides.
3. MVP constraint is enforced at save-time and execution-time.
4. Harness selection is deterministic and auditable.
5. Secret material is never exposed via API responses, logs, or audit payloads.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [theloop.md](../definitions/theloop.md)
- [event.md](../definitions/event.md)
- [nfr.md](../definitions/nfr.md)
