# OpenAI API Connection Contract Plan

## Objective

Define owner-scoped provider definitions with independent chat and embedding capabilities, plus loop-level OpenRouter key selection that is deterministic, auditable, and secure.

## Scope

- Owner-scoped provider definition schema
- OpenRouter-only runtime for this phase
- OpenAI-compatible chat-completion and embedding capabilities
- Independent model configuration and validation per capability
- HTTP and HTTPS endpoint validation
- Loop assignment lifecycle and permissions
- Deterministic key selection algorithms and fallback
- Credential envelope persistence and redaction behavior

## Contract definition

### Provider definition schema

Provider definitions are independent records with:

1. `providerId` (stable identifier)
2. `displayName`
3. `providerType` (`openrouter` only in this phase)
4. `baseUrl` (HTTP or HTTPS)
5. encrypted credential envelope fields
6. `chatDefaultModel` and `chatEnabledModels`
7. `embeddingDefaultModel` and `embeddingEnabledModels`
8. lifecycle status

One definition has one base URL and credential and may expose chat, embedding, both, or
neither. A capability is available when its enabled-model list is non-empty. A default
model is optional, but when present it must belong to that capability's enabled list.

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
2. `baseUrl` must use HTTP or HTTPS.
3. `requestTimeoutMs` must be bounded.
4. `maxRetries` must be bounded.
5. Priority values must be unique per loop.
6. Assignment order/override edits are admin-only.
7. Chat and embedding models are validated through their corresponding upstream endpoint.
8. An upstream provider authentication failure is a provider-validation failure and must
	not be surfaced as an Athena session authentication response.

Model discovery classifies models by their advertised output modalities. `text` output is
chat-capable and `embedding` output is embedding-capable. Missing modality metadata remains
chat-compatible for providers that do not expose the richer catalog shape.

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
6. Integrate chat-capable provider selection into task execution.
7. Add the OpenAI-compatible embeddings client and capability-specific model validation.
8. Add E2E tests for permissions, endpoint scheme enforcement, independent capability
	configuration, validation failures, deterministic selection, and redaction.

## Acceptance criteria

1. Owners can manage provider definitions independent of loops.
2. OpenRouter-only provider runtime is enforced.
3. HTTP and HTTPS endpoint validation is enforced.
4. Multi-key assignment and deterministic selection are supported.
5. Secret material is never exposed.
6. Chat and embedding model settings can be configured independently on one provider.
7. Embedding batch responses are associated by response index and returned in input order.
8. Embedding credential failures preserve the previously saved provider configuration.
9. Every execution-time provider selection is filtered by its explicitly requested
	capability.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [theloop.md](../definitions/theloop.md)
- [task.md](../definitions/task.md)
- [nfr.md](../definitions/nfr.md)
