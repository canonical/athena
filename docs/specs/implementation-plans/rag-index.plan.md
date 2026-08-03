# RAG Index Implementation Plan

## Objective

Implement the RAG index abstraction defined in
[rag-index.md](../definitions/rag-index.md) with a Markdown-file-collection adapter as
the example source: a derived, semantic retrieval index over a corpus of Markdown files
that index-enabled personas query through a lookup tool to bring relevant reference
knowledge into their decisions.

MVP scope: a Markdown file collection, overlapping chunking with file-and-offset lineage,
pull retrieval through a lookup tool, pure semantic ranking, a single fixed embedding
model, Postgres with pgvector, strictly per-loop.

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
- Embedding via an extension to the loop OpenAI API-compatible provider contract.
- `rebuild`-based ingestion: walk the corpus, chunk, embed, idempotently upsert.
- A per-index lookup tool, governed by the per-loop tool allow/deny list.
- Config CRUD, rebuild, and audit.

Out of scope (deferred):

- Task and conversation adapters (including loop-history memory) and task-timeline
  as-of ordering.
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
- Ingestion is two-phase: chunk rows are persisted first with `embedding` NULL, then
  embedded in a separate step that targets `embedding IS NULL`, so it is resumable and
  degrades gracefully when no provider is available. The MVP runs both phases inline in the
  admin-triggered `rebuild` command; because phase two is an idempotent job unit, the scale
  path is a durable job queue — a Postgres-backed one (`pg-boss` or `graphile-worker`)
  reusing the existing database, rather than a Redis-backed `BullMQ` or a new service.
- Chunking is a pluggable strategy, independent of the source adapter. The MVP strategy is
  a fixed-size overlapping window (`fixedOverlap`, parametrized by window size and overlap,
  sized in tokens against the embedding input limit); backtrack offsets are stored in
  characters. New strategies (structural, semantic, recursive) register against the same
  contract without touching sources or retrieval.
- Embeddings extend the loop OpenAI-compatible provider contract (a profile with an
  `embeddingModel`, called at `/v1/embeddings`), so
  [openai-api-connection.plan.md](./openai-api-connection.plan.md) grows an embeddings
  capability. The provider is per-loop config, not a fixed vendor.
- The MVP pins `text-embedding-3-small` (1536 dimensions), reachable over `/v1/embeddings`
  via GitHub Models/Foundry or OpenRouter. The choice is reversible: each entry stores its
  source `text` and the index is rebuildable, so switching models is a re-embed via
  `rebuild` — a same-dimension swap is pure re-embed, a different dimension also needs a
  column migration.
- Build order: implement the provider contract with its embeddings extension first; stub
  embeddings only in tests, not as a shipped shortcut.

## Dependencies and assumptions

1. Embeddings extend the provider contract in
   [openai-api-connection.plan.md](./openai-api-connection.plan.md). OpenAI exposes
   embeddings via a separate `POST /v1/embeddings` endpoint, distinct from chat
   completions. Not every OpenAI API-compatible provider implements it, so embeddings are
   an optional provider capability.
2. A single embedding model is pinned for the MVP, fixing the schema's vector dimension.
   The specific model and the reversibility of that choice are in
   [Decisions](#decisions); automated migration tooling for model changes is out of
   scope, and a dimension change is a `rebuild` plus a column migration.
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
- Embedding config: `embeddingProviderRef`, `embeddingModel`, `embeddingModelVersion`
  (the index owns its model).
- Chunking config: `chunkingStrategy` (TEXT), the strategy discriminator (MVP
  `fixedOverlap`), and `chunking` (JSONB), its parameters — for `fixedOverlap`, the window
  `size` and `overlap` — mirroring the `sourceType`/`source` split.
- Behavior: the index object exposes `lookup(query, limit)` (filtered semantic retrieval)
  and `rebuild` (full re-projection of the source). Enumerate and projection are a
  per-`sourceType` adapter strategy; splitting projected text into chunks is a separate
  per-`chunkingStrategy` strategy; the index delegates to both.
- MVP: created when an admin opts a loop in, sourcing that loop's Markdown collection.

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
- `embedding` (`vector(1536)`, nullable): the MVP model's dimension
  (`text-embedding-3-small`). Chunk rows are written before embedding; a row is retrievable
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

## Embedding integration (provider extension)

- Add `embeddingModel` (optional) to the provider profile; a profile that declares it can
  serve embeddings.
- Embeddings call the profile `baseUrl` at the `/embeddings` path with
  `{ input, model: embeddingModel }`.
- Selection uses deterministic provider priority per
  [llm-harness.md](../definitions/llm-harness.md), considering only embedding-capable
  profiles.
- If no embedding-capable provider is available, `rebuild` defers and retrieval proceeds
  with no context.

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
- Graceful degradation: if no embedding-capable provider is available, phase 1 still
  persists the chunks and phase 2 fills them in on a later run; retrieval meanwhile returns
  only already-embedded rows.
- The corpus is a snapshot; live watching and incremental supersession are future. The MVP
  runs both phases inline in `rebuild`; see [Decisions](#decisions) for the queue scale
  path.

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
- Embedding credentials resolve via `credentialRef` only and are never logged.

## Configuration and lifecycle

- `ragIndex` and `loopRagAttachment` CRUD with loop-admin authorization; index config lives
  on the `ragIndex` record, the retrieval bound on the attachment, and the lookup-tool grant
  on the per-loop tool allow/deny list.
- Retrieval is opt-in: an admin enables a loop by creating its index over the Markdown
  collection, attaching it, and granting the lookup tool. Enabling triggers a `rebuild`;
  disabling detaches and removes the index and its entries.
- The MVP fixes the embedding model, so no model-change re-index path is required beyond
  `rebuild`; a rebuilding status applies to `rebuild`.
- All config changes are audited.

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

1. Extend the provider profile with `embeddingModel` and an embeddings call path.
2. Add the pgvector extension and `ragIndex` / `ragEntry` / `loopRagAttachment` migrations
   (shared entry table, btree `index`, no global ANN index); update the database image and
   compose.
3. Define the component `schema.ts` (Zod and types), the source-adapter strategy, and
   `ragIndex` / `loopRagAttachment` CRUD with loop-admin authorization; on opt-in, create
   the Markdown index and attach it to the loop.
4. Implement the Markdown adapter (enumerate and project the file collection) and the
   `fixedOverlap` chunking strategy (windowed split with offset lineage) behind the
   strategy contract, feeding the shared redact/embed/idempotent-upsert pipeline under
   `rebuild`.
5. Implement the lookup tool: mandatory index-scope filter, pure semantic ranking, bounded
   chunk output with citation, and tool-execution recording and snapshot.
6. Register the lookup tool per index and gate it on the per-loop tool allow/deny list.
7. Add audit.
8. Add tests for isolation, lineage, idempotent rebuild, snapshot replay, and failure paths.

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

## Related specs

- [rag-index.md](../definitions/rag-index.md)
- [theloop.md](../definitions/theloop.md)
- [tool-usage.md](../definitions/tool-usage.md)
- [llm-harness.md](../definitions/llm-harness.md)
- [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [nfr.md](../definitions/nfr.md)
