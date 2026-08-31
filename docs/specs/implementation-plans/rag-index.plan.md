# RAG Infrastructure and Loop Self-Memory Plan

## Objective

Build common RAG infrastructure that supports diverse index kinds, embedding contracts, and
consumers. Deliver loop self-memory as the first
specialization without encoding loop ownership or whole-entry behavior into the base index.

Current status: Phase 0 migration enforcement is implemented, but its missing-extension and
upgrade verification remain pending. Phase 1 is complete. Phase 2 is the active next phase.

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
- `loopActivityObservation`: loop-activity-specific transactional outbox.
- Persist fixed loop-activity source and whole-entry segmentation descriptors. Use provider
  embedding plus default retrieval and storage services.
- Keep embedding, retrieval, and storage in separate modules.
- Keep the Memory UI as a loop-self-memory specialization. It configures the immutable
  self-memory index.
- Replace configuration by deleting the old index before creating the new index, releasing
  the old provider dependency.
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

## Phase 2: Transactional observations and durable projection

- Write loop-activity observations in the same transaction as knowledge-bearing domain
  mutations.
- Rebuild from canonical tasks, messages, tool decisions/results, runner results, and curated
  workgraph state.
- Register index-scoped rebuild/project jobs and durable outbox reconciliation.
- Project source records through the default projection and fixed provider embedding
  implementation into the common entry repository.
- Enforce one embedding contract/dimension per index and lifecycle guards on writes.

Verification:

- UI E2E creates history before enablement and observes `rebuilding -> ready`; later
  activity projects asynchronously.
- `test_inference` reversed batch responses verify response-index association.
- `deterministic-embed-8` and `deterministic-embed-16` verify independent indexes and
  variable dimensions.
- Concurrent enable/retry, process restart, invalid credentials, repair, and retry verify
  idempotency and durable recovery.

## Phase 3: Projection semantics and security

- Complete loop-activity source adapters.
- Keep messages additive; supersede mutable task/workgraph state by logical identity.
- Redact before RAG persistence and apply the UTF-8-safe 8 KiB source-record bound before
  `wholeEntry` segmentation.
- Capture nothing while self-memory is disabled.

Verification:

- E2E verifies additive messages and one active entry for repeated mutable-state edits.
- Fake secrets and oversized text verify redaction/truncation without raw content leakage.
- `test_inference` chat/tool calls verify assistant, approval, and tool-result observations.

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

- Disable atomically deletes self-memory observations and entries while retaining immutable
  configuration.
- Re-enable/retry sets `rebuilding`, drops any partial derived data, and performs a full
  rebuild of the same index; lookup stays unavailable until ready.
- Serialize ordinary rebuild work per index. Do not add a rebuild revision in the current
  scope; purge and re-create the index when compatibility or uncertain stale work requires
  a new identity.
- Enforce writable lifecycle and embedding dimension in entry writes; lookup
  requires a ready index and matching query dimension.

Verification:

- E2E verifies disable removes lookup/data and disabled-time activity creates no RAG rows.
- Re-enable backfills all canonical history, including disabled-time activity.
- Two-page disable-during-rebuild and replacement scenarios verify lifecycle guards and the
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
