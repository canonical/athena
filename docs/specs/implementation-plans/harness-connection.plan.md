# Harness Connection Contract Plan

## Objective

Define loop-scoped harness selection and execution for IC and CR personas within Athena's deterministic routing model.

A harness is the LLM or coding tool provider that IC and CR personas use to execute work. Harness selection must be deterministic per loop, auditable, and support fallback under provider unavailability.

## Scope

- Loop-scoped harness activation model (what's allowed to execute)
- Deterministic harness priority ordering
- MVP execution constraint (GitHub Copilot Cloud Agent only)
- Fallback and unavailability behavior
- Audit trail for harness selection and failures

## Harness catalog (predefined set)

1. **GitHub Copilot Cloud Agent** — MVP executable; required for IC and CR work in Phase 1.
2. **OpenAI Codex** — Post-MVP candidate; requires separate API management.
3. **Claude Code** — Post-MVP candidate; requires separate API management.
4. **Juju machine charm based harness** — MVP+1 Athena-owned target; internal/self-hosted runtime.
5. **Devin** — Post-MVP candidate; external specialized tool execution.

## Loop-scoped harness contract

### What a loop admin configures

For each loop, the admin selects:

1. An ordered priority list of harnesses (e.g. `[GitHub Copilot Cloud Agent, Codex, Claude Code]`).
2. For each harness: credential reference (API key or auth token), timeout, retry settings.
3. Which harnesses are active/enabled for that loop.

### Deterministic harness selection (per IC/CR execution)

When IC or CR persona is assigned an event:

1. Athena evaluates the loop's harness priority list in order.
2. Select the first enabled harness where credentials are available.
3. Execute the IC/CR work through that harness.
4. If the harness is unavailable or the request fails, try the next harness in priority order.
5. Persist the selected harness ID and any fallback decision in the event audit trail.

### MVP execution constraint

1. In MVP, the **only executable harness** is `GitHub Copilot Cloud Agent`.
2. Loop admins must configure at least one enabled profile for GitHub Copilot Cloud Agent.
3. If admins include other harnesses in their priority list, Athena will skip them with an error logged (e.g. "post-MVP harness unavailable in MVP").
4. This constraint is enforced at loop-admin profile-save time and at IC/CR execution time.

## Validation and safety gates

1. At least one enabled harness must exist in a loop's priority list before activation.
2. Priority order must be unique and deterministic per loop.
3. In MVP: reject any loop profile that does not include or prioritize GitHub Copilot Cloud Agent.
4. Credential references must be resolvable and non-empty before IC/CR execution.
5. Timeout and retry bounds must be within configured system limits.

## Observability and auditability

Every IC/CR execution must capture:

1. `loopId`
2. `assignedPersona` (IC or CR)
3. `selectedHarnessId`
4. `attemptNumber`
5. `fallbackActivated` (if a non-primary harness was selected)
6. `executionResult` (`success` or failure reason)
7. `failureCategory` (`unavailable`, `timeout`, `auth_error`, `validation_error`, or other)
8. timestamp

Harness profile create/update actions must audit: actor, loop ID, harness priority list changes, and before/after credential references (redacted in output).

## Implementation steps

1. Define loop harness profile schema (ordered harness list with credentials, timeouts, retries).
2. Implement loop-admin CRUD for harness profiles (create, list, update, delete).
3. Add MVP validation: reject non-Copilot harnesses in MVP at profile-save and execution time.
4. Implement IC/CR harness selector: deterministic priority evaluation, credential resolution, fallback logic.
5. Integrate with IC/CR execution path to pass selected harness to persona workload.
6. Add audit logging for profile changes and harness selection/fallback decisions.
7. Add integration tests: priority ordering, fallback under unavailability, MVP constraint enforcement, all-harnesses-down behavior.

## Acceptance criteria

1. Loop admins can configure ordered harness profiles with credentials and timeouts.
2. **MVP constraint enforced**: Only GitHub Copilot Cloud Agent is executable; other harnesses in a profile are skipped with clear error logging.
3. IC and CR personas receive the deterministically selected harness (first enabled/available in priority order).
4. Harness selection is deterministic: same loop configuration always selects the same harness under identical availability conditions.
5. Fallback is auditable: every fallback decision is logged with harness ID, reason, and selected alternative.
6. All-harnesses-down path pauses loop execution (per provider availability semantics in [theloop.md](../definitions/theloop.md)) without closing events.
7. Harness profile lifecycle (create/update/delete) is fully audited with actor and timestamp.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [theloop.md](../definitions/theloop.md)
- [event.md](../definitions/event.md)
- [nfr.md](../definitions/nfr.md)
