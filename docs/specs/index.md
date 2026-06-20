# Athena Specs Index

This index is the entry point for Athena local specification, reference, and persona artifacts.

**Note**: Athena is deterministic orchestration code, not a persona. Personas are LLM agents and humans that integrate with Athena loops.

## Required Personas

Every Athena loop **must** have an engineering manager (EM) persona. Persona lifecycle and constraints are defined in [persona.md](./definitions/persona.md) and [theloop.md](./definitions/theloop.md). Persona files are reference definitions only.

## Definitions

See [definitions/index.md](./definitions/index.md) for all normative definition files.
Cross-cutting non-functional requirements are defined in [definitions/nfr.md](./definitions/nfr.md).

## Near-Term Definition Backlog

1. Webhook secret storage model: replace hash-only wording with a verifiable key-management design for HMAC (for example envelope encryption/KMS).
2. Formal state machines: define allowed transitions for loop execution states and event lifecycle states.
3. Deterministic retry/failover parameters: define attempt limits, backoff policy, and terminal-failure behavior.
4. Provider health-check contract: define probe method, timeout, pass/fail thresholds, and resume gating.
5. Quantified NFR targets: add SLI/SLO targets for latency, throughput, and recovery windows.
6. Ordering and fairness semantics: define queue ordering model and starvation/fairness guarantees.
7. Config/schema versioning policy: define compatibility and migration rules for provider and validation schemas.
8. Canonical audit schema: define required audit fields, retention window, and redaction policy.
9. Data governance for model/webhook payloads: define retention, redaction, access scope, and deletion behavior.
10. Determinism test matrix: define required multi-instance, idempotency, failover, and pause/resume verification scenarios.

## Reference Personas

See [personas/index.md](./personas/index.md) for all reference persona files.
