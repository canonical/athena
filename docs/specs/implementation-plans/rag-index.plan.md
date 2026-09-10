# RAG Infrastructure and Loop Self-Memory Plan

## Objective

Build common RAG infrastructure that supports diverse index kinds, embedding contracts, and
consumers. Deliver loop self-memory as the first
specialization without encoding loop ownership or whole-entry behavior into the base index.

Current status: Phase 0 migration enforcement is implemented, but its missing-extension and
upgrade verification remain pending. Phase 1 is complete. Phase 2 implements task queue
messages through persisted source records, index-specific projections, and separate
full-build and single-entry append jobs; the remaining source adapters and recovery
verification are still in progress.

## Remaining delivery task list

Complete the remaining work in this order. The universal lookup tool is the next active
implementation slice; the later items remain part of delivery and are not deferred merely
because the first demo path works.

- [x] Reconcile the RAG implementation with the separate web/worker deployment topology.
- [ ] Expose one universal `rag_lookup` tool with `{ index, query, limit? }`, resolving the
  reserved `self` alias within the active loop.
- [ ] Connect lookup to provider query embedding and exact vector ranking, with ready-state,
  embedding-dimension, loop-scope, result-bound, and tool-policy enforcement.
- [ ] Return attributable source metadata and persist the ordinary tool-result snapshot so
  replay never re-queries a changed index.
- [ ] Add a UI-driven E2E demonstration in which `test_inference` invokes `rag_lookup`, recalls
  a known fact from earlier loop activity, and uses the retrieved evidence in its answer.
- [ ] Add lookup coverage for cross-loop isolation, policy denial, variable embedding
  dimensions, deterministic tie-breaking, and replay after source supersession.
- [ ] Complete loop-activity source adapters for tool decisions/results, runner results, and
  mutable workgraph state.
- [ ] Implement logical-reference supersession for mutable records while preserving additive
  task messages.
- [ ] Verify secret redaction and the UTF-8-safe 8 KiB source bound through the rendered UI.
- [ ] Verify durable recovery and lifecycle races: reversed embedding batches, invalid
  credentials followed by repair, process restart, concurrent enable/repair,
  remove-during-build, and replacement.
- [ ] Verify pgvector prerequisite failure, clean installation, upgraded databases, and
  idempotent migration replay.
- [ ] Complete operational logging, query-plan evidence, runbook documentation, deployment
  smoke testing, full E2E/coverage validation, and final specification status updates.

## Phase 0: PostgreSQL platform prerequisite

PostgreSQL must provide the `vector` extension before Athena application migrations run.
Athena migrations verify this prerequisite but do not install PostgreSQL extensions.

Verification:

- Prove Athena migration fails before RAG DDL when `vector` is absent and succeeds after a
  database administrator installs it.
- Verify clean and upgraded databases contain `vector` and accept vector DDL.

## Phase 1: Correct and establish the common index core

Status: complete as of 2026-08-30.

Refactor the current Phase 1 schema before committing further projection work:

- `ragIndex`: common identity, kind, immutable source strategy/reference, segmentation and
  embedding configuration, lifecycle, rebuild progress, and diagnostics; remove the direct
  loop field. `loopActivity` stores its loop UUID as the generic source reference.
- `ragEntry`: common segmented output with source timestamp and segment identity.
- `ragRecordSource`: append-only provider-independent rendered source registry.
- `ragRecordProjection`: index-specific transactional projection outbox and status.
- Persist fixed loop-activity source and whole-entry segmentation descriptors. Use provider
  embedding plus default retrieval and storage services.
- Keep embedding, retrieval, and storage in separate modules.
- Keep the Memory UI as a loop-self-memory specialization. Enabling creates the immutable
  self-memory index and starts its build; users do not manage build lifecycle transitions.
- Keep loop routes limited to self-memory discovery and enablement; address repair, removal,
  and other index lifecycle operations through `/rag/:index/...` routes.
- Replace configuration by removing the old index and enabling a new one, releasing the old
  provider dependency.
- Delete a loop-owned self-memory index with its source loop.
- Block provider deletion or loop-provider removal while a current index depends on it.

Verification:

- Fresh migration and idempotent replay verify direct loop source lookup and timestamped
  segment identity.
- UI E2E configures a dedicated embedding provider distinct from chat, persists the
  self-memory index, verifies no eligible-provider state, and verifies member read-only
  access.
- UI E2E verifies immutable replacement, old-provider release, dependency guards, and loop
  deletion cleanup.
- Static architecture checks ensure loop identity uses the generic source reference and
  pgvector SQL occurs only in the storage repository.
- Production backend build, repository checks, lint, clean/idempotent migration replay, and
  all focused RAG E2E scenarios passed.

## Phase 2: Transactional source records and durable projection

The append-only task-message slice uses two jobs. `rag-index-build` pages over persisted
source records, creates missing index projections, and enqueues one `rag-entry-append` job
per pending projection. The same append job projects source records created after the build.
Task queue item UUIDs provide stable source identity, and readable source-specific renderers
convert message, tool, and runner records into bounded text before persistence and embedding.

- Write source records and applicable projections in the same transaction as knowledge-bearing
  domain mutations while an index exists.
- Build from canonical tasks, messages, tool decisions/results, runner results, and curated
  workgraph state.
- Register index-scoped build/project jobs and an admin-triggered scan-and-repair command for
  failed projections, missing entries, and transient enqueue gaps.
- Project source records through the default projection and fixed provider embedding
  implementation into the common entry repository.
- Enforce one embedding contract/dimension per index and lifecycle guards on writes.

Verification:

- UI E2E creates history before enablement and observes `rebuilding -> ready`; later
  activity projects asynchronously.
- `test_inference` reversed batch responses verify response-index association.
- `deterministic-embed-8` and `deterministic-embed-16` verify independent indexes and
  variable dimensions.
- Concurrent enable/repair, process restart, invalid credentials, and repair verify
  idempotency and durable recovery.

## Phase 3: Projection semantics and security

- Complete loop-activity source adapters.
- Keep messages additive; supersede mutable task/workgraph state by logical identity.
- Redact before RAG persistence and apply the UTF-8-safe 8 KiB source-record bound before
  `wholeEntry` segmentation.
- Persist source records and create live projections only while an index is rebuilding or
  ready; reconstruct sources from canonical history when enabling or repairing.

Verification:

- E2E verifies additive messages and one active entry for repeated mutable-state edits.
- Fake secrets and oversized text verify redaction/truncation without raw content leakage.
- `test_inference` chat/tool calls verify assistant, approval, and tool-result source records.

## Phase 4: Universal alias-based lookup

- Add one universal `rag_lookup` tool with `{ index, query, limit? }`.
- Resolve reserved alias `self` directly to the loop's self-memory index.
- Delegate query embedding and ranking to the default retrieval and storage services.
- Enforce loop alias scope, lifecycle, dimension, and tool policy in the
  executor.
- Persist normal tool-result snapshots for replay.

Verification:

- Script `test_inference` to call `rag_lookup` with `index: "self"` and retrieve a known
  semantic match.
- E2E proves loop isolation, policy denial/success, variable-dimension isolation, stable
  tie-breaking, and immutable old tool results after source supersession.

## Phase 5: Self-memory activation lifecycle and races

- Enable creates an index in `rebuilding` and automatically starts its full build; lookup
  stays unavailable until ready.
- Remove atomically deletes the loop-owned index, projections, entries, and source records.
- Give loop admins an icon-only scan-and-repair action that preserves valid entries, retries
  failed or missing projections, recomputes progress, and queues a canonical source scan.
- Serialize ordinary build work per index. Do not add a build revision in the current scope;
  remove and re-enable when compatibility or uncertain stale work requires a new identity.
- Enforce writable lifecycle and embedding dimension in entry writes; lookup
  requires a ready index and matching query dimension.

Verification:

- E2E verifies remove deletes lookup/data and activity without an index creates no RAG rows.
- Re-enable backfills all canonical history, including activity created while no index existed.
- Two-page remove-during-build and replacement scenarios verify lifecycle guards and the
  purge/re-create recovery path.

## Phase 6: Reusable index attachments

Deferred until a second index kind exists; it will be implemented on the common core:

- Add loop attachments with a unique loop-local alias.
- Keep attachment access lifecycle separate from index lifecycle/storage.
- Add standalone discovery and authorization appropriate to the owning index kind.
- Reuse the same `rag_lookup` tool and projection/repository pipeline.

Verification:

- E2E attaches one reusable index under two different aliases in separate authorized loops,
  verifies exact alias routing and isolation, and proves detaching does not delete shared
  index data.

## Phase 7: Operations and release validation

- Complete structured redacted logs, queue/runbook documentation, repository query plans,
  and graceful producer/worker shutdown.
- Add a second source or segmentation implementation in tests or a small production use case,
  introducing an abstraction only when the concrete requirements are known.

Verification:

- Run focused lifecycle/isolation/projection suites, `npm run check`, `npm run lint`, full
  `npm test`, and coverage-enabled CI validation.
- Deployment smoke starts from a database that completed the PostgreSQL platform migration
  and verifies fresh/upgraded Athena schemas plus web/worker restart recovery.

## Invariants

- Base index rows contain no source-kind ownership fields.
- Kind-specific source/configuration lives in one-to-one relational tables.
- Index configuration is immutable; rebuilds clear and repopulate the same index.
- One index has one embedding provider/model/dimension.
- Entries are source-neutral segments and include occurrence timestamp plus segment
  identity.
- Self-memory is resolved through reserved alias `self`; reusable indexes use attachments.
- Attachment removal never deletes a standalone shared index.
- Projection does not depend on the default storage service.
- Job payloads contain index identity only, and lookup results are replay snapshots.
