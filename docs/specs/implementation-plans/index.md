# Implementation Plans Index

This index is the entry point for implementation planning artifacts.

## Consolidated Task List

### Persona Definition Capability (Foundation)

- [ ] Define persona schema, lifecycle, and capability model (IC, CR, EM, PM, QA, UX personas and their execution roles within loop orchestration). Detailed plan: [persona-management.plan.md](./persona-management.plan.md)

### Loop-Based Definitions First (Blocking)

- [x] Define owner-scoped OpenRouter connection contract (definition schema, HTTPS endpoint, encrypted credential envelope, assignment, timeout/retry, and deterministic key fallback). Detailed plan: [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [x] Split the shared provider connection into explicit chat and embedder capabilities without duplicating endpoint or credential configuration. Detailed plan: [provider-capabilities.plan.md](./provider-capabilities.plan.md)
- [x] Define owner-scoped runner contract (catalog, assignment, allow/deny, and deterministic execution profile/key selection). Detailed plan: [runner-connection.plan.md](./runner-connection.plan.md)
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
- [ ] Define loop-level audit contract (required tasks, actor/context fields, retention, and redaction policy).
- [ ] Deliver [workgraph-jira-poc.plan.md](./workgraph-jira-poc.plan.md): Workgraph definition and loop assignment model with Jira-only selectable type for POC.

Implementation order:

1. User request
2. Tool execution task source
3. Webhook task
4. Scheduler task
5. System task
6. Manual override task

### RAG Index (depends on provider capabilities)

- [x] Deliver [background-processing.plan.md](./background-processing.plan.md): PostgreSQL-backed jobs with transaction-scoped enqueueing, separate Athena and `pg-boss` schema preparation, and a dedicated Compose worker. Rock and charm integration remains deferred.
- [x] Deliver private loop-history memory: an admin-selected embedder, asynchronous backfill, atomic incremental ingestion, and the derived loop-scoped `own-memory-lookup` tool.
- [ ] Deliver [rag-index.plan.md](./rag-index.plan.md): a general retrieval-index abstraction with a Markdown-file-collection adapter as the example source — overlapping chunking with file-and-offset lineage, pull retrieval through a per-index lookup tool gated by the tool allow/deny list, pure semantic ranking, one configured embedding model per index projection, Postgres with pgvector, strictly per-loop. Embeds through the provider's explicit embedder capability; dimensions are observed per projection, with 1,536 recommended and 3,072 as the hard limit.

### Phase 0: Foundations

- [ ] Finalize webhook secret storage model for verifiable HMAC (replace hash-only wording with envelope-encryption/KMS style key management).
- [ ] Align all loop/task specifications to the current minimal task model (`id`, `title`) and remove legacy lifecycle assumptions.
- [ ] Define deterministic retry/failover parameters (attempt limits, backoff, terminal behavior).
- [ ] Define provider health-check contract (probe, timeout, thresholds, resume gating).
- [ ] Define provider/schema versioning and migration policy for harness/LLM profiles and validation contracts.
- [ ] Define canonical audit record schema, retention policy, and redaction requirements.

### Phase 1: Core loop baseline

- [ ] Deliver [task-source.phase1.plan.md](./task-source.phase1.plan.md): User request task source with deterministic routing, outcomes, and blocked handoff.

### Phase 2: Internal execution evidence

- [ ] Deliver [task-source.phase2.plan.md](./task-source.phase2.plan.md): Tool execution task source with structured records, validation metadata, and deterministic failure handling.

### Phase 3: External inbound tasks

- [ ] Deliver [task-source.phase3.plan.md](./task-source.phase3.plan.md): Webhook ingestion with verification, replay protection, deduplication, and standard loop routing.

### Phase 4: Automation and operations

- [ ] Deliver [task-source.phase4.plan.md](./task-source.phase4.plan.md): Scheduler, System, and Manual override task sources with governance and auditability.

### Phase 5: Hardening and production readiness

- [ ] Quantify NFR targets (SLI/SLO for latency, throughput, and recovery windows).
- [ ] Define queue ordering/fairness semantics and starvation guarantees.
- [ ] Define data governance for model/webhook payload retention, access, and deletion behavior.
- [ ] Execute deterministic multi-instance verification matrix (idempotency, failover, pause/resume, duplicate suppression).
- [ ] Run load and failure-injection validation against NFR targets.
- [ ] Publish operational runbooks (provider outage handling, manual override controls, incident triage paths).
