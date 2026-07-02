# Implementation Plans Index

This index is the entry point for implementation planning artifacts.

## Consolidated Task List

### Persona Definition Capability (Foundation)

- [ ] Define persona schema, lifecycle, and capability model (IC, CR, EM, PM, QA, UX personas and their execution roles within loop orchestration). Detailed plan: [persona-management.plan.md](./persona-management.plan.md)

### Loop-Based Definitions First (Blocking)

- [ ] Define loop-scoped OpenAI API connection contract (provider profile schema, endpoint, model, credential reference, timeout, retry, and fallback order). Detailed plan: [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [ ] Define loop-scoped harness contract (catalog, allow/deny, and execution profile selection). Detailed plan: [harness-connection.plan.md](./harness-connection.plan.md)
  - [ ] Define GitHub Copilot Cloud Agent harness profile as MVP executable option.
  - [ ] Define OpenAI Codex harness profile as post-MVP candidate.
  - [ ] Define Claude Code harness profile as post-MVP candidate.
  - [ ] Define Juju machine charm based harness profile as MVP+1 Athena-owned target.
  - [ ] Define Devin harness profile as post-MVP candidate.
  - [ ] Define activation/lifecycle statuses for each listed harness (MVP executable, candidate, MVP+1 target).
  - [ ] Define loop-level allow/deny policy and deterministic priority/fallback selection across the listed harnesses.
  - [ ] Define harness audit and telemetry requirements (profile changes, selected harness, fallback decisions, failure categories).
- [ ] Define loop provider/harness availability behavior (pause, resume, check frequency, and deterministic recovery rules).
- [ ] Define loop-level validation contract for LLM/harness outputs (Zod schema versioning and failure handling).
- [ ] Define loop-level audit contract (required events, actor/context fields, retention, and redaction policy).

Implementation order:

1. User request
2. Tool execution event source
3. Webhook event
4. Scheduler event
5. System event
6. Manual override event

### RAG Index (depends on provider/embeddings contract)

- [ ] Deliver [rag-index.plan.md](./rag-index.plan.md): loop-scoped semantic RAG index over recorded history (Tier 1), assembly, pure semantic ranking, single fixed embedding model, Postgres with pgvector, per-persona access, strictly per-loop, targeting event-source-driven loops. Open decision: embedding source.

### Phase 0: Foundations

- [ ] Finalize webhook secret storage model for verifiable HMAC (replace hash-only wording with envelope-encryption/KMS style key management).
- [ ] Define formal state machines for loop lifecycle and event lifecycle, including pause/resume transitions.
- [ ] Define deterministic retry/failover parameters (attempt limits, backoff, terminal behavior).
- [ ] Define provider health-check contract (probe, timeout, thresholds, resume gating).
- [ ] Define provider/schema versioning and migration policy for harness/LLM profiles and validation contracts.
- [ ] Define canonical audit event schema, retention policy, and redaction requirements.

### Phase 1: Core loop baseline

- [ ] Deliver [event-source.phase1.plan.md](./event-source.phase1.plan.md): User request event source with deterministic routing, outcomes, and blocked handoff.

### Phase 2: Internal execution evidence

- [ ] Deliver [event-source.phase2.plan.md](./event-source.phase2.plan.md): Tool execution event source with structured records, validation metadata, and deterministic failure handling.

### Phase 3: External inbound events

- [ ] Deliver [event-source.phase3.plan.md](./event-source.phase3.plan.md): Webhook ingestion with verification, replay protection, deduplication, and standard loop routing.

### Phase 4: Automation and operations

- [ ] Deliver [event-source.phase4.plan.md](./event-source.phase4.plan.md): Scheduler, System, and Manual override event sources with governance and auditability.

### Phase 5: Hardening and production readiness

- [ ] Quantify NFR targets (SLI/SLO for latency, throughput, and recovery windows).
- [ ] Define queue ordering/fairness semantics and starvation guarantees.
- [ ] Define data governance for model/webhook payload retention, access, and deletion behavior.
- [ ] Execute deterministic multi-instance verification matrix (idempotency, failover, pause/resume, duplicate suppression).
- [ ] Run load and failure-injection validation against NFR targets.
- [ ] Publish operational runbooks (provider outage handling, manual override controls, incident triage paths).
