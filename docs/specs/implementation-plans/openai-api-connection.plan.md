# OpenAI API Connection Contract Plan

## Objective

Define owner-scoped provider definitions and loop-level OpenRouter key selection that is deterministic, auditable, and secure.

## Scope

- Owner-scoped provider definition schema
- OpenRouter-only runtime for this phase
- HTTPS endpoint validation with an HTTP exception for deterministic test inference
- Loop assignment lifecycle and permissions
- Deterministic key selection algorithms and fallback
- Credential envelope persistence and redaction behavior

## Contract definition

### Provider definition schema

Provider definitions are independent records with:

1. `providerId` (stable identifier)
2. `displayName`
3. `providerType` (`openrouter` only in this phase)
4. `baseUrl` (HTTPS in normal operation; HTTP permitted for deterministic test inference)
5. encrypted credential envelope fields
6. lifecycle status

### Loop assignment contract

1. Users can assign one or more provider definitions to loops.

2. Loop admins exclusively select selection algorithm per loop from the Deterministic selection algorithm list.
3. Priority values must be unique and deterministic per loop.

### Deterministic selection and fallback

Both OpenRouter and Copilot pools support:

1. Round Robin
2. Highest Credit Percentage Available
3. Highest Absolute Credit Available
4. Weighted Round Robin by credit
5. Least Recently Used key
6. Priority Failover
7. Health-aware selection with cooldown window

Fallback contract:

- Missing algorithm metrics or algorithm-specific evaluation failures fall back deterministically to priority failover.
- Tie-breakers are deterministic: priority, then createdAt, then id.

## Validation rules

1. `providerType` must be `openrouter` in this phase.
2. `baseUrl` must use HTTPS, except for deterministic test inference where HTTP is permitted.
3. `requestTimeoutMs` must be bounded.
4. `maxRetries` must be bounded.
5. Priority values must be unique per loop.
6. Assignment order/override edits are admin-only.

## Security and credential handling

1. API keys are entered directly and stored as encrypted credential envelopes.
2. No plaintext secret material in API responses, logs, or audit payloads.
3. Internal runtime selection may decrypt credentials for execution needs.
4. Credential failures are recorded as redacted operational failures.

## Observability and audit

For each selection attempt, capture:

1. `loopId`
2. `poolType` (`openrouter` or `copilot`)
3. `selectedAssignmentId` (or null)
4. `algorithmRequested`
5. `algorithmUsed`
6. `fallbackReason`
7. `skipped[]` with deterministic reason
8. timestamp

## Implementation steps

1. Add owner-scoped provider definition persistence with encrypted credential envelope fields.
2. Add loop provider assignment persistence with priority/override/runtime metrics.
3. Implement owner-only provider definition CRUD.
4. Implement loop member assignment and admin-only order/override updates.
5. Implement deterministic key selection engine and fallback behavior.
6. Integrate minimal execution-time hook in task flow.
7. Add E2E tests for permissions, endpoint scheme enforcement, the deterministic test-inference exception, OpenRouter-only enforcement, deterministic selection, and redaction.

## Acceptance criteria

1. Owners can manage provider definitions independent of loops.
2. OpenRouter-only provider runtime is enforced.
3. HTTPS endpoint validation and the deterministic test-inference HTTP exception are enforced.
4. Multi-key assignment and deterministic selection are supported.
5. Secret material is never exposed.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [theloop.md](../definitions/theloop.md)
- [task.md](../definitions/task.md)
- [nfr.md](../definitions/nfr.md)
