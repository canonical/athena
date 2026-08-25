# RAG Index Definition

## Summary

A RAG index gives Athena's personas access to a body of knowledge that
exceeds their context window: it holds that knowledge as embedded, chunked entries and,
on request, returns the most relevant slice to the persona that asks. The index is a
standalone entity that a loop attaches, and a persona consumes it as a lookup tool
alongside its other tools. This document defines the general capability first, then the
first example source — a collection of Markdown files.

## Problem

Personas are LLM agents and decide from a bounded context window, but the knowledge
relevant to a decision routinely exceeds it — reference material, specifications,
runbooks, and other bodies of documentation that cannot all be held in context. Athena
has no way to give a persona retrievable access to such a corpus, so decisions are made
on whatever happens to fit in the prompt.

## The capability

A RAG index is a first-class, standalone entity over a pluggable data source. A loop
gains access to a body of knowledge by attaching an index; a persona retrieves from the
indexes attached to its loop through a lookup tool.

It is a context input only: it never changes ownership, routing authority, or approvals
defined in [theloop.md](./theloop.md). It is deterministic, auditable, replayable,
opt-in per loop, and governed by loop administrators under the same model as harness and
provider settings in [llm-harness.md](./llm-harness.md); Athena remains deterministic
orchestration code.

## Index model and sources

An index owns its data source, embedding capability reference, and chunking, ingestion,
and rebuild procedures. A source adapter turns one source type into ingestible documents.
Adapters are pluggable. The initial adapters are a Markdown file collection and a loop's
own persisted history. A loop-to-index attachment makes an index available to a loop and
carries that loop's consumption settings for it.

Isolation follows attachment: a persona retrieves only through indexes attached to its
loop, and retrieval never reaches an index the loop has not attached. Attaching an index
to more than one loop (sharing) requires authorized, audited attachment and is out of
scope for the MVP.

## The index is a derived projection

The index is a derived projection over its source, never the canonical record. Because
it is derived:

- It must be fully rebuildable from its source, and nothing enters it except through the
  ingestion pipeline.
- Configuration changes — a different embedding model, new chunking parameters — are
  re-projections via `rebuild`, not data migrations.
- Rebuildability is per-source: the Markdown source is fully rebuildable from the files
  themselves.

## Chunking and lineage

Splitting a document into chunks is a pluggable **chunking strategy**, independent of the
source adapter: the adapter yields a document's text, and the strategy cuts that text into
an ordered list of chunks. Keeping the two concerns orthogonal lets any chunking strategy
compose with any source, and lets the splitting approach evolve — structural, semantic, or
recursive — without touching the sources or the retrieval engine.

A chunk is text plus a backtrack to its exact origin. Whatever the strategy, each chunk
records its lineage — for the Markdown source, the file path and the character span
(`startOffset`, `endOffset`) it was cut from, plus its ordinal in the document. Lineage
makes every retrieved chunk traceable to its source location and citable back to it, and
ingestion is idempotent on that identity, so re-running it never double-inserts.

The MVP strategy is a **fixed-size overlapping window**, parametrized by a window size and
a neighbor overlap: consecutive windows share a configurable span, so a passage split
across a boundary still appears whole in at least one chunk. Both parameters are index
configuration (see [Index configuration](#index-configuration)). Because windows overlap,
a single passage can surface as two adjacent chunks; the MVP returns both (recurrence is
itself a signal) and defers merge or deduplication.

## Ingestion and rebuild

Ingestion is out-of-band: it is never fired from within loop task handling, so it
cannot affect any task outcome. It runs in two decoupled phases: the chunking strategy
splits each document and the pipeline upserts the chunks, then each chunk still missing an
embedding is put through the model. A chunk is written before its embedding and becomes
retrievable only once embedded, so ingestion degrades gracefully when the embedding
provider is unavailable — the chunks persist and are embedded on a later run.

- `rebuild` re-projects the whole source: it walks the corpus, chunks each document,
  upserts the chunks, and embeds those still missing an embedding. A per-document content
  hash lets `rebuild` skip unchanged documents cheaply.
- The Markdown source is treated as a snapshot: `rebuild` is the update path, and the
  index is eventually consistent with the files. Live file-watching and incremental
  supersession are a future capability.
- Loop history is a live source. Enabling it backfills existing task queues and archives;
  every subsequently persisted history item atomically queues incremental ingestion.
  Each persisted item is one entry without additional chunking in the initial version.
- Ingestion must not persist secrets, since index content is re-surfaced into persona
  context.

## Retrieval

An index is consumed one way in the MVP: as a **lookup tool**. Attaching an index to a
loop and granting a persona its lookup tool — through the same per-loop tool allow/deny
list as any other tool in [tool-usage.md](./tool-usage.md) — is what gives that persona
access. There is no separate access flag; RAG access is tool access.

- A persona calls the tool with a query; Athena scopes the retrieval to the loop's
  attached indexes and returns a bounded, ordered list of chunks ranked by semantic
  similarity, each carrying its lineage as attribution.
- The result is injected into the persona through the normal tool-result path and
  recorded as a tool execution per [tool-usage.md](./tool-usage.md).

Deterministic assembly of context at routing time is not part of this capability;
retrieval is always a persona-initiated tool call.

## Determinism and replay

- Retrieval is a tool execution: its returned chunks are snapshotted into the tool
  execution record per [tool-usage.md](./tool-usage.md), and replay reuses that snapshot
  verbatim rather than re-querying a possibly-rebuilt index.
- Exact vector search makes live retrieval deterministic for a fixed index and query, so
  the snapshot and a fresh query agree until the index is rebuilt.
- The Markdown source carries no task-timeline position, so retrieval applies no as-of
  filter; a future task or conversation source, whose entries are ordered against the
  loop timeline, would reintroduce as-of ordering.

## Index configuration

Configuration lives in two places: the index itself — source, embedding model, chunking
parameters — on the `ragIndex` record, and how a loop consumes an attached index on the
attachment. Changes are audited (actor, timestamp, prior and new value), consistent with
[llm-harness.md](./llm-harness.md).

- `source`: the corpus the index projects; for the Markdown adapter, the file collection
  to ingest.
- `chunking`: the chunking strategy and its parameters; the MVP strategy is a fixed-size
  overlapping window, parametrized by a window size and a neighbor overlap.
- `embedding`: a reference to a provider's embedder capability plus the `model` and
  `modelVersion` used by the projection and its observed `dimensions`. The provider
  capability configures the model; dimensions are not provider configuration. Different
  indexes may use different dimensions, but one projection is dimensionally uniform.
  Athena recommends 1,536 dimensions and rejects vectors above 3,072.

Lifecycle: retrieval is opt-in — a loop has no index until an admin enables it, which
creates the index over its source, attaches it, and rebuilds from the source. Disabling
detaches the index and removes its entries. Changing the embedding model or chunking
parameters invalidates existing vectors and requires an admin-triggered `rebuild` that
exposes a rebuilding status; Athena never mixes vectors across model versions.

## Loop-owned history memory

A loop may enable `hasHistoryRag` and select an active provider embedder. The implemented
storage uses a private `loopHistoryRag` configuration and loop-scoped
`loopHistoryRagEntry` rows rather than the future general `ragIndex` attachment model.
Enabling queues a backfill. The UI
warns that existing history may take several minutes to become dependable and exposes
missing, indexing, ready, and failed lifecycle state. Disabled retained indexes use
`missing` because they are unavailable to the loop runtime.

The source contains everything Athena persists as loop history across every task: live
queue messages, archived messages, user and assistant content, assistant tool calls, tool
results and failures, approval or rejection messages, compaction records, persona
attribution, status, and timestamps. Each source item becomes one entry for now. Its
lineage includes the loop, task, queue-item identity, archive/live origin, timestamp,
role, persona, and tool metadata where present.

New history persistence and its ingestion job share one PostgreSQL transaction. Backfill
embeds batches of 50; incremental ingestion handles one appended item or refreshes a task
after mutations to existing or multiple items. Both are idempotent on loop, task, and
queue-item identity. Disabling prevents new ingestion and removes the tool from use but
retains the derived entries for efficient re-enablement.

The `own-memory-lookup` tool searches only the executing persona's current loop-history
index. It cannot select another loop or a general attached index. Its availability is
derived only from `hasHistoryRag`: it is not displayed or independently configurable in
the loop Tools screen. The persona supplies the semantic query and optional result limit;
Athena embeds that query unchanged. Calls and results persist as normal tool messages.

## Failure handling

- Retrieval failures are tool execution failures, recorded per
  [tool-usage.md](./tool-usage.md); a failed lookup returns no context and the persona
  proceeds without it.
- Ingestion failure leaves canonical source history intact. A failed backfill exposes its
  error on `loopHistoryRag` and can be retried by re-enabling or changing its provider.
- Embedding uses the referenced provider's embedder capability. It does not participate in
  the loop chat-provider selection or failover behavior in
  [llm-harness.md](./llm-harness.md).

## Planned standalone source: Markdown file collections

The planned example implementation of the general attachment abstraction is a collection
of Markdown files — a reference knowledge base a loop can consult. It is deliberately
chosen to exercise chunking, overlap, and lineage that the already-delivered
record-oriented loop-history source does not.

- Source: a set of Markdown files, treated as a snapshot and (re)projected by `rebuild`.
- Chunks: overlapping windows of each file's text, with `filePath` and character-span
  lineage for backtrack and citation.
- Consumer: any index-enabled persona, through the index's lookup tool; the routing
  persona in [theloop.md](./theloop.md) is one such consumer, not a privileged one.
- Scope: the index is attached only to the loop that enabled it, so retrieval is strictly
  loop-scoped.

## Future directions

- Other task and conversation adapters and task-timeline as-of ordering beyond the
  loop-owned live memory source.
- Live, incrementally-updated sources with supersession, replacing the snapshot `rebuild`
  model.
- Curated entries: personas committing distilled knowledge as an additive tier on the
  same index and retrieval engine.
- Query-time facets derived from chunk parameters (for example partitioning a corpus by
  environment), and cross-loop sharing of an index.

## Cross references

- Loop ownership, membership, and routing: [theloop.md](./theloop.md)
- Tool execution records and tool allow/deny policy: [tool-usage.md](./tool-usage.md)
- Provider configuration, validation, and availability:
  [llm-harness.md](./llm-harness.md)
- Provider capability contract:
  [provider-capabilities.plan.md](../implementation-plans/provider-capabilities.plan.md)
- Non-functional requirements: [nfr.md](./nfr.md)
