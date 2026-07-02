# RAG Index Implementation Plan

## Objective

Implement the loop-scoped RAG index as defined in
[rag-index.md](../definitions/rag-index.md): a derived, semantic retrieval index
over recorded loop history that surfaces relevant prior context to index-enabled
non-coding personas, to improve decision-making quality, most importantly the
engineering manager's routing decisions.

MVP scope: recorded history (Tier 1), assembly, pure semantic ranking, a single
fixed embedding model, Postgres with pgvector, strictly per-loop, targeting
event-source-driven loops.

The loop RAG index is implemented as the default instance of a general
retrieval-index abstraction: an index is a first-class, standalone entity that owns
its data source, embedding model, and ingestion procedures, and a loop attaches the
indexes it retrieves from. The MVP builds the abstraction plus exactly one source
adapter, the loop event log; in the MVP a loop-event-log index is attached only to
the loop it sources. The index object is `ragIndex` (exposing `append` and
`lookup`), its entries live in a shared `ragEntry` table, and loop-to-index
attachments live in `loopRagAttachment`.

## Scope

In scope:

- The retrieval-index abstraction (`ragIndex`, a shared `ragEntry` table, and
  `loopRagAttachment`) backed by Postgres with pgvector.
- A source-adapter contract, with the loop-event-log adapter as the only
  implementation.
- Embedding via an extension to the loop OpenAI API-compatible provider contract.
- Index-owned ingestion: the loop's event handler fires the index at the end of
  handling a settled event, plus enumerate-based backfill on opt-in.
- Deterministic assembly returning a bounded list of context strings.
- Per-persona index access gating.
- Config CRUD, backfill, and audit.

Out of scope (deferred):

- A mutable index type for changing data (documents, external systems), with its
  own pull ingestion, upsert, supersession, and tombstoning.
- Cross-loop attachment (attaching an index to a loop other than the one it
  sources) and its authorization.
- Curated writes (Tier 2) and any commit tool.
- Human-managed governance.
- Retention and compaction.
- Multiple or variable embedding models and re-embedding migration.
- Non-semantic ranking (recency, kind weighting), grouping, and deduplication.
- Active redundant-work optimization or execution short-circuiting.
- The `Retrieve` pull tool (assembly-only for v1).
- An evaluation harness or proxy metrics.

## Open decisions

One decision is unresolved and gates the items under it; it should be settled
before implementation starts.

- **Embedding source.** Where embeddings come from is undecided. Leading
  candidates, all OpenAI-compatible: GitHub Models graduating to Microsoft Foundry
  Models (the GitHub ecosystem already used for the Copilot harness), or OpenRouter
  (an independent gateway). Using the Copilot API directly is excluded — it is
  ToS-restricted to official Copilot clients.

Downstream of that one decision:

- The embedding model, and therefore the `vector(<dim>)` dimension (for example
  `text-embedding-3-small` is 1536).
- Whether embeddings flow through the loop OpenAI provider contract, and hence the
  sequencing: extend
  [openai-api-connection.plan.md](./openai-api-connection.plan.md) first, or stub
  embeddings and retrofit.
- Whether [openai-api-connection.plan.md](./openai-api-connection.plan.md) needs an
  embeddings-capability note.

## Dependencies and assumptions

1. Embeddings extend the provider contract in
   [openai-api-connection.plan.md](./openai-api-connection.plan.md). OpenAI exposes
   embeddings via a separate `POST /v1/embeddings` endpoint, distinct from chat
   completions. Not every OpenAI API-compatible provider implements it, so
   embeddings are an optional provider capability.
2. A single embedding model is fixed for the MVP. The chosen model fixes the vector
   dimension used in the schema. Changing the model later is a migration and is out
   of scope.
3. Events have immutable content and a mutable lifecycle (`created` to `routed` to
   `completed` or `blocked`). An entry is committed when an event reaches a terminal
   status, capturing both the ask and the outcome.
4. The MVP uses exact vector search, so live retrieval is deterministic for a fixed
   index and embedding model; the snapshot still guards replay across model or
   config changes (see [Determinism and replay](#determinism-and-replay)).
5. The index targets event-source-driven loops (webhook and other automated
   sources) where each event is self-contained. It is left off for user-heavy chat
   loops.

## Storage: Postgres and pgvector

- Use the existing PostgreSQL 16 instance with the `pgvector` extension
  (`CREATE EXTENSION IF NOT EXISTS vector`).
- Packaging: switch the database image to one that ships the extension (for example
  `pgvector/pgvector:pg16`) or bake it into the rock; update
  [compose.yaml](../../../compose.yaml) accordingly.
- All indexes share one `ragEntry` table; the `index` FK is the scoping key.
- Primary access pattern:
  `WHERE index = ? AND orderKey <= ? ORDER BY embedding <=> :q LIMIT k`.
- Btree on `(index, orderKey)` enforces isolation (restricting to the loop's
  attached index ids) and the as-of range in one scan, producing the candidate set
  for a single index.
- MVP ranks with exact vector search over that candidate set and adds no global ANN
  index. At per-loop scale (hundreds to low thousands of entries) exact KNN is
  inexpensive and gives perfect recall, perfect isolation, and determinism.
- A global HNSW or IVFFlat index is deliberately avoided: a global ANN search with a
  selective `index = ?` post-filter can return few or zero rows from the target
  index (recall collapse), which is both a correctness and an isolation risk.
- Scale path (future, when one index outgrows exact search): per-index ANN via
  pgvector iterative index scans, `pgvectorscale` label-filtered DiskANN, or
  hash-partitioning `ragEntry` by `index`.
- Rationale: vectors live beside their relational data, so semantic search runs
  inside the mandatory index-scope and as-of filters in one transactional query,
  with no dual-write or second store to keep consistent.

## Data model

`ragIndex` (the standalone index object; one row per index):

- `id` (uuidv7).
- `sourceType` (TEXT): the adapter type; MVP is `loopEventLog` (an immutable index).
- `sourceLoop` (UUID): for `loopEventLog`, FK to the `loop` whose event log this
  index reads, `ON DELETE CASCADE`. This binds the index to its source; it does not,
  by itself, grant any loop retrieval access — attachment does.
- Embedding config: `embeddingProviderRef`, `embeddingModel`,
  `embeddingModelVersion` (the index owns its model).
- `cursor`: ingestion watermark for enumerate and backfill.
- Behavior: the index object exposes `append(unit)` (ingest one ingestible unit) and
  `lookup(query, asOf, limit)` (filtered semantic retrieval), plus enumerate-based
  `backfill`. Source-specific enumerate and projection are a per-`sourceType`
  strategy the index delegates to.
- MVP: created when an admin opts a loop in, sourcing that loop's event log.

`loopRagAttachment` (a loop's use of an index):

- `loop` (UUID) and `index` (UUID, FK to `ragIndex`), primary key `(loop, index)`,
  both `ON DELETE CASCADE`.
- `enabled` (boolean).
- Assembly settings: `inject` (boolean), window bound (`maxEntries` or token budget).
- A loop retrieves only through its enabled attachments. MVP: a loop-event-log index
  is attached only to the loop it sources.

`ragEntry` (shared table; one row per indexed unit, across all indexes):

- `id` (uuidv7).
- `index` (UUID): FK to `ragIndex`, `ON DELETE CASCADE`; the scoping key and the
  isolation boundary.
- `sourceRef` (TEXT): stable identifier in the source. For `loopEventLog` this is
  the `event` id.
- `orderKey`: the as-of anchor copied from the source event (uuidv7 id or
  `emittedAt`), not the row insertion time, so asynchronous ingestion and backfill
  do not corrupt ordering.
- `provenance` (JSONB): source-specific metadata; for `loopEventLog` the
  `originPersona` symbolic id from `event.emittedByPersona`.
- `kind` (TEXT): record kind, stored for future ranking; unused in MVP ranking.
- `text` (TEXT): the deterministic projection that was embedded.
- `embedding` (`vector(<dim>)`): dimension fixed by the MVP model.
- Entries are immutable; there is no update or supersession path in the MVP.
- Postgres indexes: btree `(index, orderKey)` for isolation and as-of; no global ANN
  index (see [Storage](#storage-postgres-and-pgvector)).
- Uniqueness: `(index, sourceRef, chunkIndex)` for idempotent upsert.

Per-persona access:

- A `ragAccess` flag on the loop persona roster, default off for coding personas.
  Assembly injects only when the attachment has `inject` enabled and the target
  persona has `ragAccess`.

Config changes (index config, attachments, access) are audited with actor,
timestamp, prior value, and new value.

Conventions: new numbered DDL under `migrations/pg/ddls/`, entity-name FKs, types
and Zod only in the component `schema.ts`, component at `src/components/rag/`.

## Embedding integration (provider extension)

- Add `embeddingModel` (optional) to the provider profile; a profile that declares
  it can serve embeddings.
- Embeddings call the profile `baseUrl` at the `/embeddings` path with
  `{ input, model: embeddingModel }`.
- Selection uses deterministic provider priority per
  [llm-harness.md](../definitions/llm-harness.md), considering only
  embedding-capable profiles.
- If no embedding-capable provider is available, ingestion defers and retrieval
  proceeds with no context.

## Ingestion

Each index owns its ingestion; the loop event log is Athena-owned and lives in
Postgres. The adapter emits normalized ingestible units (`sourceRef`, `text`,
`orderKey`, `provenance`) that the shared pipeline redacts, embeds with the index's
model, and idempotently upserts.

- Trigger: loop event handling fires the owning index at the very end of handling a
  settled event (`completed` or `blocked`), passing a reference. The index reads the
  settled event and appends it. Firing after the event is fully handled means the
  update, and any failure in it, cannot affect the event outcome.
- Projection: the deterministic field projection (`requestedOutcome`, selected
  `payload` fields, `blocker`, outcome), redacted, truncated or chunked only if it
  exceeds the embedding input limit. No LLM summarization.
- Both chat-visible and internal spawned events are indexed; `provenance`
  distinguishes them.
- Backfill: when an admin opts a loop in, `enumerate(cursor)` walks prior settled
  events and appends them.
- Idempotency: the `(index, sourceRef, chunkIndex)` unique key prevents
  double-insert under retry, backfill, and concurrent instances, consistent with
  [event.md](../definitions/event.md).
- Embedding failure: retry; the event log remains the durable source, so nothing is
  lost.

## Retrieval and assembly

- Trigger: when routing an event to an index-enabled persona, primarily the
  engineering manager.
- Query: the event being routed, encoded with the same field projection used for
  stored entries (event-only; target events are self-contained).
- Filters (mandatory): `index` in the loop's enabled attached indexes, and as-of
  `orderKey <= <event order>`. In the MVP that is the single loop-event-log index
  attached to the loop.
- Ranking: pure semantic similarity, with a stable tie-break by `orderKey` then
  `id`. Duplicates are retained; recurrence is itself a signal.
- Output: a bounded, ordered list of context strings, each carrying its `provenance`
  attribution.
- Injection: the strings are added to the persona prompt or messages.
- Snapshot: the returned strings are persisted into the event's assembled-context
  record so replay reuses them verbatim.

## Determinism and replay

- The index is a derived projection, fully rebuildable from the event log.
- The MVP uses exact vector search (no ANN index), so live retrieval is
  deterministic for a fixed index and embedding model.
- The retrieved string list is still snapshotted on the event so replay stays exact
  across embedding-model or config changes, and so a future move to approximate
  search does not change replayed decisions.
- As-of filtering by `orderKey` guarantees a retrieval never surfaces entries whose
  source event is newer than the event being served.

## Security and isolation

- Every query is filtered to the loop's enabled attached index ids; add a
  defense-in-depth check and an explicit no-cross-loop-leak test.
- Redact secrets at ingestion per [tool-usage.md](../definitions/tool-usage.md).
- Index content is re-injected into prompts and is therefore a prompt-injection
  vector; treat indexed content as untrusted.
- Embedding credentials resolve via `credentialRef` only and are never logged.

## Configuration and lifecycle

- `ragIndex` and `loopRagAttachment` CRUD with loop-admin authorization; index
  config lives on the `ragIndex` record, assembly settings on the attachment.
- Retrieval is opt-in: an admin enables a loop by creating its loop-event-log index
  and attaching it. Enabling backfills from history; disabling detaches and removes
  or deactivates the index and its entries.
- The MVP fixes the embedding model, so no model-change re-index path is required
  yet; a rebuilding status applies to backfill.
- All config changes are audited.

## Audit and evaluation

- Audit ingestion jobs, retrieval and assembly (query basis, returned entry ids and
  count), config changes, and backfill jobs.
- Evaluation of decision-quality impact is retrospective, using the snapshotted
  retrieved set and the audit trail. No evaluation harness or proxy metrics are
  built for the MVP.

## Testing

Per [testing-standards.md](../../testing-standards.md):

- As-of correctness (no future-entry leakage) by `orderKey`, including backfilled
  rows.
- Snapshot equals replay (assembled strings reused verbatim).
- Loop isolation: no cross-loop retrieval (security-critical).
- Idempotent ingestion under retry and concurrent instances.
- Backfill on enable.
- Graceful failure: embedding provider down yields no context and no ownership
  change.

## Implementation steps

1. Extend the provider profile with `embeddingModel` and an embeddings call path.
2. Add the pgvector extension and `ragIndex` / `ragEntry` / `loopRagAttachment`
   migrations (shared entry table, btree `(index, orderKey)`, no global ANN index);
   update the database image and compose.
3. Define the component `schema.ts` (Zod and types), the source-adapter strategy,
   and `ragIndex` / `loopRagAttachment` CRUD with loop-admin authorization; on
   opt-in, create the loop-event-log index and attach it to the loop.
4. Implement the loop-event-log adapter: fire the index from loop event handling at
   settlement, plus `enumerate`-based backfill on opt-in, feeding the shared
   project/redact/embed/idempotent-upsert pipeline.
5. Implement assembly (event-only query, mandatory index-scope and as-of filters,
   pure semantic ranking, bounded string output, snapshot).
6. Gate injection on the attachment `inject` setting and per-persona `ragAccess`.
7. Add audit.
8. Add tests for replay determinism, isolation, as-of, idempotency, backfill, and
   failure paths.

## Acceptance criteria

1. Loop admins can enable and configure the index; enabling backfills from history.
2. On an index-enabled persona route, relevant prior context is injected as a
   bounded string list and snapshotted on the event.
3. Replaying an event reuses the snapshot and never re-queries.
4. Retrieval never crosses loop boundaries.
5. Embedding or provider unavailability degrades to no context without changing
   ownership or closing events.
6. Ingestion is idempotent under retry and concurrent instances.

## Related specs

- [rag-index.md](../definitions/rag-index.md)
- [theloop.md](../definitions/theloop.md)
- [event.md](../definitions/event.md)
- [tool-usage.md](../definitions/tool-usage.md)
- [llm-harness.md](../definitions/llm-harness.md)
- [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [nfr.md](../definitions/nfr.md)
