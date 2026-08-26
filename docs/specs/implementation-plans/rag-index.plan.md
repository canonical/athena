# RAG Index Implementation Plan

## Status

The provider embedder capability, durable background-job foundation, pgvector setup, and
private loop-history memory are implemented. Dependency and concurrency hardening for
private history is implemented and verified through the existing UI-driven E2E stack;
its production rollout gate remains pending in
[loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md). The standalone
`ragIndex`, Markdown source, shared `ragEntry`, and `loopRagAttachment` work described
below also remain planned.

## Objective

Implement the RAG index abstraction defined in
[rag-index.md](../definitions/rag-index.md) with a Markdown-file-collection adapter as
the example source: a derived, semantic retrieval index over a corpus of Markdown files
that index-enabled personas query through a lookup tool to bring relevant reference
knowledge into their decisions.

MVP scope: a Markdown file collection, overlapping chunking with file-and-offset lineage,
pull retrieval through a lookup tool, pure semantic ranking, one configured embedding
model per index projection, Postgres with pgvector, strictly per-loop.

The Markdown index is implemented as the example instance of a general retrieval-index
abstraction: an index is a first-class, standalone entity that owns its data source,
embedding model, chunking, and ingestion, and a loop attaches the indexes it retrieves
from. The MVP builds the abstraction plus exactly one source adapter, the Markdown file
collection, attached only to the loop that enabled it. The index object is `ragIndex`
(exposing `lookup` and `rebuild`), its entries live in a shared `ragEntry` table, and
loop-to-index attachments live in `loopRagAttachment`.

## Scope

In scope:

- The retrieval-index abstraction (`ragIndex`, a shared `ragEntry` table, and
  `loopRagAttachment`) backed by Postgres with pgvector.
- A source-adapter contract, with the Markdown-file-collection adapter as the only
  implementation.
- A chunking-strategy contract, with a fixed-size overlapping window (`fixedOverlap`) as
  the only implementation, producing file-path-and-character-offset lineage.
- Embedding through the referenced provider's explicit embedder capability.
- `rebuild`-based ingestion: walk the corpus, chunk, embed, idempotently upsert.
- A per-index lookup tool, governed by the per-loop tool allow/deny list.
- Config CRUD, rebuild, and audit.

Delivered prerequisite scope:

- Private loop-history memory enabled by `hasHistoryRag`, with a selected embedder,
  asynchronous backfill, transactional incremental ingestion, lifecycle state, and the
  derived loop-scoped `own-memory-lookup` tool.

Out of scope (deferred):

- Other task and conversation adapters and general task-timeline as-of ordering.
- Live file-watching and incremental supersession; the MVP rebuilds a snapshot.
- Cross-loop attachment (sharing an index across loops) and its authorization.
- Curated writes and any commit tool.
- Query-time facets derived from chunk parameters.
- Retention and compaction.
- Multiple or variable embedding models and re-embedding migration beyond `rebuild`.
- Alternative chunking strategies beyond the fixed-size overlapping window.
- Non-semantic ranking (recency, kind weighting), and chunk merge or deduplication.
- Deterministic context assembly at routing time (retrieval is pull-only).

## Decisions

- Access is a tool, not a flag. Each attached index is exposed to a persona as a lookup
  tool alongside its other tools, gated by the per-loop tool allow/deny list in
  [tool-usage.md](../definitions/tool-usage.md). This is the whole of RAG access control;
  there is no separate per-persona RAG flag.
- Retrieval is pull-only and its result is snapshotted into the tool execution record, so
  replay reuses it. The Markdown source carries no task-timeline position, so retrieval
  applies no as-of filter (a future ordered source would).
- Ingestion is out-of-band via `rebuild`; it is never fired from loop task handling and
  cannot affect a task outcome. The Markdown corpus is a snapshot; `rebuild` is the
  update path.
- Loop history is an already-delivered private projection rather than an implementation
  of the future general attachment schema. Persisting a history item atomically queues
  ingestion, while enablement queues an idempotent backfill of existing live and archived
  task history.
- Ingestion is two-phase: chunk rows are persisted first with `embedding` NULL, then
  embedded in a separate step that targets `embedding IS NULL`, so it is resumable and
  degrades gracefully when no provider is available. Both phases run as durable
  PostgreSQL-backed jobs through
  [background-processing.md](../definitions/background-processing.md); the admin-triggered
  command atomically queues a rebuild and returns without waiting for ingestion.
- Chunking is a pluggable strategy, independent of the source adapter. The MVP strategy is
  a fixed-size overlapping window (`fixedOverlap`, parametrized by window size and overlap,
  sized in tokens against the embedding input limit); backtrack offsets are stored in
  characters. New strategies (structural, semantic, recursive) register against the same
  contract without touching sources or retrieval.
- A provider is one shared connection with explicit chat and embedder capabilities, as
  defined in [provider-capabilities.plan.md](./provider-capabilities.plan.md). The
  embedder capability calls `/v1/embeddings` with the provider's shared base URL and
  credential. An index references this capability directly; it does not use the loop chat
  provider pool.
- The embedder capability configures the model; Athena does not hardcode one. Each entry
  stores its source `text` and the index is rebuildable, so switching models is a re-embed
  via `rebuild`. Dimensions are observed projection metadata, never provider
  configuration: 1,536 is the recommended storage target, 3,072 is the hard limit, and
  every non-null vector in one projection has the same dimensions.
- Build order: implement the provider capability split first. Tests use the published
  deterministic inference service through the ordinary provider HTTP contract; neither
  production nor test code injects an in-process embedding stub.

## Dependencies and assumptions

1. Provider capability separation is delivered first through
   [provider-capabilities.plan.md](./provider-capabilities.plan.md). OpenAI-compatible
   APIs expose embeddings through `POST /v1/embeddings`, distinct from chat completions,
   so embeddings are an optional capability on the shared provider connection.
2. Each index projection uses the model configured by its referenced embedder capability.
   Model changes require `rebuild`. Indexes may have different observed dimensions, but
   one projection never mixes dimensions. A future optional per-index
   `requestedDimensions` may ask a supporting model for a smaller projection; it is not
   provider configuration and is outside the MVP.
3. The Markdown corpus is a snapshot ingested and refreshed by `rebuild`; it is not
   watched for live edits in the MVP.
4. The MVP uses exact vector search, so live retrieval is deterministic for a fixed index
   and query; the tool-execution snapshot still guards replay across rebuilds (see
   [Determinism and replay](#determinism-and-replay)).

## Storage: Postgres and pgvector

- Use the existing PostgreSQL 16 instance with the `pgvector` extension
  (`CREATE EXTENSION IF NOT EXISTS vector`).
- Packaging: switch the database image to one that ships the extension (for example
  `pgvector/pgvector:pg16`) or bake it into the rock; update
  [compose.yaml](../../../compose.yaml) accordingly.
- All indexes share one `ragEntry` table; the `index` FK is the scoping key.
- Primary access pattern: `WHERE index = ? ORDER BY embedding <=> :q LIMIT k`.
- Btree on `index` enforces isolation (restricting to the loop's attached index ids),
  producing the candidate set for a single index before the vector ordering.
- MVP ranks with exact vector search over that candidate set and adds no global ANN index.
  At per-loop corpus scale (hundreds to low thousands of chunks) exact KNN is inexpensive
  and gives perfect recall, perfect isolation, and determinism.
- A global HNSW or IVFFlat index is deliberately avoided: a global ANN search with a
  selective `index = ?` post-filter can return few or zero rows from the target index
  (recall collapse), which is both a correctness and an isolation risk.
- Scale path (future, when one index outgrows exact search): per-index ANN via pgvector
  iterative index scans, `pgvectorscale` label-filtered DiskANN, or hash-partitioning
  `ragEntry` by `index`.
- Rationale: vectors live beside their relational data, so semantic search runs inside the
  mandatory index-scope filter in one transactional query, with no dual-write or second
  store to keep consistent.

## Data model

`ragIndex` (the standalone index object; one row per index):

- `id` (uuidv7).
- `sourceType` (TEXT): the adapter type; MVP is `mdCollection`.
- `source` (JSONB): source-specific configuration; for `mdCollection`, the file
  collection to ingest.
- Embedding config: a foreign key to `providerEmbedder`, plus the
  `embeddingModel`, `embeddingModelVersion`, and nullable `embeddingDimensions` observed
  for the current projection. The first successful embedding establishes dimensions;
  1,536 is recommended and 3,072 is the maximum.
- Chunking config: `chunkingStrategy` (TEXT), the strategy discriminator (MVP
  `fixedOverlap`), and `chunking` (JSONB), its parameters — for `fixedOverlap`, the window
  `size` and `overlap` — mirroring the `sourceType`/`source` split.
- Behavior: the index object exposes `lookup(query, limit)` (filtered semantic retrieval)
  and `rebuild` (full re-projection of the source). Enumerate and projection are a
  per-`sourceType` adapter strategy; splitting projected text into chunks is a separate
  per-`chunkingStrategy` strategy; the index delegates to both.
- MVP: created when an admin opts a loop in, sourcing that loop's Markdown collection.
- Loop memory: one private `loopHistory` index is created when an admin enables
  `hasHistoryRag` and selects an active provider embedder.

`loopRagAttachment` (a loop's use of an index):

- `loop` (UUID) and `index` (UUID, FK to `ragIndex`), primary key `(loop, index)`, both
  `ON DELETE CASCADE`.
- `enabled` (boolean).
- Retrieval bound: `maxChunks` or token budget for a lookup result.
- A loop retrieves only through its enabled attachments, and a persona reaches an index
  only when granted its lookup tool by the per-loop tool allow/deny list. MVP: the
  Markdown index is attached only to the loop it sources.

`ragEntry` (shared table; one row per chunk, across all indexes):

- `id` (uuidv7).
- `index` (UUID): FK to `ragIndex`, `ON DELETE CASCADE`; the scoping key and the isolation
  boundary.
- `sourceRef` (TEXT): stable identifier of the chunk's source document. For `mdCollection`
  this is the file path.
- `chunkIndex` (INT): the chunk's ordinal within its source document.
- `startOffset` / `endOffset` (INT): the character span of the source document this chunk
  was cut from — the backtrack for citation and future supersession.
- `provenance` (JSONB): source-specific metadata.
- `contentHash` (TEXT): hash of the source document, so `rebuild` skips unchanged
  documents.
- `text` (TEXT): the chunk text that was embedded.
- `embedding` (`vector`, nullable): variable-width storage preserves the space benefit of
  smaller models. Every non-null embedding must match its index's
  `embeddingDimensions`; chunk rows are written before embedding and become retrievable
  only once embedded, so retrieval filters `embedding IS NOT NULL`.
- Postgres indexes: btree `index` for isolation; no global ANN index (see
  [Storage](#storage-postgres-and-pgvector)).
- Uniqueness: `(index, sourceRef, chunkIndex)` for idempotent upsert.

Per-persona access is the tool allow/deny list in
[tool-usage.md](../definitions/tool-usage.md): a persona reaches an index only when
granted its lookup tool. There is no `ragAccess` column.

Config changes (index config, attachments, tool grants) are audited with actor,
timestamp, prior value, and new value.

Conventions: new numbered DDL under `migrations/pg/ddls/`, entity-name FKs, types and Zod
only in the component `schema.ts`, component at `src/components/rag/`.

## Embedding integration (provider capability)

- Reuse the shared provider base URL and encrypted credential through its required
  `providerEmbedder` capability.
- Embeddings call the shared `baseUrl` at the `/embeddings` path with
  `{ input, model }` through the `ProviderEmbedder` class.
- The index holds a direct capability reference. No loop-provider priority or failover
  selection occurs for embedding.
- If the referenced provider or embedder capability is inactive or unavailable, `rebuild`
  defers and retrieval proceeds with no context.

## Chunking

Chunking is a pluggable strategy, independent of the source adapter and the embedding
model. The strategy contract is a single method — `chunk(text): Chunk[]` — that takes a
document's text and returns an ordered list of chunks, each a `{ text, startOffset,
endOffset }`; the pipeline assigns `chunkIndex` by order and attaches the source lineage
(`sourceRef`). Keeping it a separate strategy lets structural,
semantic, or recursive splitters be added later without touching sources or retrieval. A
strategy is selected by the `chunkingStrategy` discriminator with its params in `chunking`,
mirroring the `sourceType`/`source` split; new strategies register against the same
contract.

- MVP strategy — `fixedOverlap`: a fixed-size sliding window over the document text.
  Parameters: `size` (window length) and `overlap` (span shared with the neighbor), sized
  in tokens against the embedding input limit; `overlap` keeps a passage that spans a
  boundary whole in at least one chunk.
- Offsets are recorded in characters even when windows are measured in tokens, so the
  `startOffset`/`endOffset` backtrack maps to an exact source span. The projection is the
  chunk's redacted text; no LLM summarization.
- The strategy is deterministic: the same document and parameters always produce the same
  chunks and offsets, so `rebuild` is reproducible and idempotent upsert is stable.
- Because windows overlap, retrieval can return two adjacent chunks for one passage; the
  MVP returns both and defers merge or deduplication.

## Ingestion (rebuild)

Ingestion is out-of-band and owned by the index; it is never fired from loop task
handling. It runs in two phases so chunking and embedding are decoupled:

1. Chunk and persist. The adapter enumerates the source into documents, the chunking
   strategy splits each into an ordered list of chunks, and the pipeline redacts and
   upserts the chunk rows with `embedding` left NULL.
2. Embed the missing. Each row with `embedding IS NULL` is put through the index's embedding
   model and updated in place. A row becomes retrievable only once embedded.

- `rebuild` walks the corpus, and for each document whose `contentHash` changed, re-chunks
  and upserts its chunks (phase 1), then embeds any unembedded rows (phase 2); unchanged
  documents are skipped.
- Idempotency: the `(index, sourceRef, chunkIndex)` unique key prevents double-insert under
  retry and concurrent runs, and phase 2 is naturally resumable — it only ever targets
  `embedding IS NULL`.
- Graceful degradation: if the referenced embedder capability is unavailable, phase 1
  still persists the chunks and phase 2 fills them in on a later run; retrieval meanwhile
  returns only already-embedded rows.
- The corpus is a snapshot; live watching and incremental supersession are future. The
  planned `rag.rebuild` job performs phase one and enqueues bounded `rag.embedBatch` jobs
  for phase two. Each job carries the projection version so superseded work cannot write.

## Retrieval (lookup tool)

- Access: each attached index is exposed to a persona as a lookup tool, gated by the
  per-loop tool allow/deny list. A persona with the tool may call it; one without it cannot
  reach the index.
- Query: the persona supplies the query text and an optional bound within the attachment's
  `maxChunks`.
- Filters (mandatory): `index` in the loop's enabled attached indexes, and
  `embedding IS NOT NULL` (unembedded chunks are not yet retrievable). In the MVP the index
  scope is the single Markdown index attached to the loop.
- Ranking: pure semantic similarity, with a stable tie-break by `sourceRef` then
  `chunkIndex`.
- Output: a bounded, ordered list of chunk texts, each carrying its lineage (`filePath`,
  character span) as citation.
- Recording: the call and its returned chunks are recorded as a tool execution per
  [tool-usage.md](../definitions/tool-usage.md), and the returned set is snapshotted so
  replay reuses it verbatim.

## Determinism and replay

- The index is a derived projection, fully rebuildable from the source.
- The MVP uses exact vector search (no ANN index), so live retrieval is deterministic for a
  fixed index and query.
- The returned chunk list is snapshotted on the tool execution so replay stays exact across
  rebuilds or embedding-model changes, and so a future move to approximate search does not
  change replayed decisions.
- The Markdown source has no task-timeline position, so retrieval applies no as-of filter;
  a future ordered source would reintroduce as-of.

## Security and isolation

- Every query is filtered to the loop's enabled attached index ids; add a
  defense-in-depth check and an explicit no-cross-loop-leak test.
- Redact secrets at ingestion per [tool-usage.md](../definitions/tool-usage.md).
- Index content is re-injected into prompts and is therefore a prompt-injection vector;
  treat indexed content as untrusted.
- Embedding credentials resolve from the shared provider credential envelope and are never
  logged.

## Configuration and lifecycle

- `ragIndex` and `loopRagAttachment` CRUD with loop-admin authorization; index config lives
  on the `ragIndex` record, the retrieval bound on the attachment, and the lookup-tool grant
  on the per-loop tool allow/deny list.
- Retrieval is opt-in: an admin enables a loop by creating its index over the Markdown
  collection, attaching it, and granting the lookup tool. Enabling triggers a `rebuild`;
  disabling detaches and removes the index and its entries.
- The current projection records its model and observed dimensions. Changing the model
  invalidates all existing vectors before `rebuild`, and a rebuilding status applies
  throughout; Athena never serves a mixture of models or dimensions.
- All config changes are audited.
- Delivered loop details expose `hasHistoryRag`, its embedder selector, and
  indexing/ready/failed state. Enabling on an existing loop warns that backfill can take
  several minutes. `own-memory-lookup` availability is derived from this setting and is
  not governed by the general tool allow/deny UI.

## Audit

- Audit `rebuild` jobs, retrieval tool executions (query basis, returned chunk ids and
  count), and config changes.

## Testing

Per [testing-standards.md](../../testing-standards.md):

- Loop isolation: no cross-loop retrieval (security-critical).
- Chunking strategy: the `fixedOverlap` window honors its `size`/`overlap` parameters, and
  chunk lineage (`startOffset`/`endOffset`) round-trips to the exact source span, including
  across overlaps.
- Idempotent `rebuild` under retry and concurrent runs; unchanged documents skipped by
  `contentHash`.
- Snapshot equals replay (returned chunks reused verbatim from the tool execution record).
- Graceful failure: embedding provider down yields no context and no ownership change.

## Implementation steps

1. [Done] Deliver the shared provider chat/embedder capability split in
   [provider-capabilities.plan.md](./provider-capabilities.plan.md).
2. [Done] Deliver the durable worker and transactional enqueueing foundation in
   [background-processing.plan.md](./background-processing.plan.md).
3. Add the pgvector extension and `ragIndex` / `ragEntry` / `loopRagAttachment` migrations
   (shared entry table, btree `index`, no global ANN index); update the database image and
   compose.
4. Define the component `schema.ts` (Zod and types), the source-adapter strategy, and
   `ragIndex` / `loopRagAttachment` CRUD with loop-admin authorization; on opt-in, create
   the Markdown index and attach it to the loop.
5. Implement the Markdown adapter (enumerate and project the file collection) and the
   `fixedOverlap` chunking strategy (windowed split with offset lineage) behind the
   strategy contract, feeding the shared redact/embed/idempotent-upsert pipeline under
   `rebuild`.
6. Register the planned `rag.rebuild` and `rag.embedBatch` jobs with projection-version
   guards, bounded batches, default queue execution, and user-visible lifecycle state.
7. Implement the lookup tool: mandatory index-scope filter, pure semantic ranking, bounded
   chunk output with citation, and tool-execution recording and snapshot.
8. Register the lookup tool per index and gate it on the per-loop tool allow/deny list.
9. Add audit.
10. [Done] Add private loop-history enablement, backfill, atomic incremental ingestion,
    lifecycle state, and the loop-scoped `own-memory-lookup` tool.
11. Add tests for isolation, lineage, idempotent rebuild, history backfill and incremental
    recall, snapshot replay, and failure paths.
12. Deliver the provider dependency guards, shared-worker backfill serialization, and
  focused race coverage in
  [loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md).

## Acceptance criteria

1. Loop admins can enable and configure the index; enabling rebuilds from the Markdown
   collection.
2. A persona granted the lookup tool retrieves relevant chunks as a bounded list, each cited
   by file path and character span.
3. Replaying the tool execution reuses the snapshot and never re-queries.
4. Retrieval never crosses loop boundaries.
5. Embedding or provider unavailability degrades to no context without changing ownership or
   closing tasks.
6. `rebuild` is idempotent under retry and concurrent runs, skipping unchanged documents.
7. [Delivered] A loop admin can enable history memory only with an embedder, sees asynchronous
   indexing state, and can retrieve relevant live or archived history through
   `own-memory-lookup` without crossing loop boundaries.

## Related specs

- [rag-index.md](../definitions/rag-index.md)
- [theloop.md](../definitions/theloop.md)
- [tool-usage.md](../definitions/tool-usage.md)
- [llm-harness.md](../definitions/llm-harness.md)
- [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [provider-capabilities.plan.md](./provider-capabilities.plan.md)
- [background-processing.plan.md](./background-processing.plan.md)
- [loop-history-rag-hardening.plan.md](./loop-history-rag-hardening.plan.md)
- [nfr.md](../definitions/nfr.md)
