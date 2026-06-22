# OpenAI API Connection Contract Plan

## Objective

Define and implement a loop-scoped OpenAI API-compatible provider contract that is deterministic, auditable, and compatible with fallback execution.

## Scope

- Loop-level provider profile schema
- Credential reference model
- Timeout and retry behavior
- Deterministic fallback order
- Validation rules
- Audit and observability requirements

## Contract definition

### Provider profile schema

Each loop can define one or more ordered provider profiles (`priority = 1..N`), with:

1. `providerId` (stable identifier)
2. `displayName`
3. `baseUrl` (OpenAI API-compatible endpoint)
4. `model` (default model identifier)
5. `apiVersion` (optional)
6. `credentialRef` (secret-manager reference, never plaintext)
7. `requestTimeoutMs`
8. `maxRetries`
9. `retryBackoffPolicy` (for example fixed or exponential)
10. `enabled` (boolean)

### Deterministic selection and fallback

1. Select highest-priority enabled profile.
2. On provider unavailability or terminal request failure, evaluate next profile in order.
3. Persist selected profile and fallback path in execution metadata.
4. If no profile succeeds, trigger loop pause behavior per loop/provider availability definitions.

## Validation rules

1. `baseUrl` may be HTTP or HTTPS. HTTP support is explicitly allowed for local inference or private-network deployments.
2. `requestTimeoutMs` must be bounded by configured min and max.
3. `maxRetries` must be bounded and deterministic.
4. Priority values must be unique per loop.
5. At least one enabled profile must exist before activation.

## Security and credential handling

1. Credentials must be resolved from `credentialRef` only.
2. No credential material is logged or returned by read APIs.
3. Credential access failures are recorded as provider failures with redacted detail.

## Observability and audit

For each request attempt, capture:

1. `loopId`
2. `providerId`
3. `model`
4. `attemptNumber`
5. `timeoutMs`
6. `retryDecision`
7. `fallbackActivated` (boolean)
8. `result` (`success` or `failure`)
9. `failureCategory` (timeout, auth, rate-limit, unavailable, validation)
10. timestamp

Profile create/update/delete actions must be audited with actor, before/after snapshot, and reason.

## Implementation steps

1. Define profile JSON schema and Zod validation schema.
2. Add loop-scoped persistence model for ordered profiles.
3. Implement profile CRUD with loop-admin authorization.
4. Implement deterministic profile selection and fallback execution.
5. Integrate retry and timeout controls.
6. Add audit events for profile lifecycle and request attempts.
7. Add integration tests for selection order, retry behavior, fallback path, and all-providers-down path.

## Acceptance criteria

1. Loop admins can configure ordered provider profiles.
2. Execution always selects providers in deterministic order.
3. Retries and fallback are deterministic and auditable.
4. Credential references are secure and never leaked.
5. All-providers-down path triggers expected pause behavior without closing events.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [theloop.md](../definitions/theloop.md)
- [event.md](../definitions/event.md)
- [nfr.md](../definitions/nfr.md)
