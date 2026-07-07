# RAG Index Definition

## Summary

A RAG index gives Athena's personas retrievable access to a body of knowledge that
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

An index owns its data source, embedding model, and chunking, ingestion, and rebuild
procedures. A source adapter turns one source type into indexable chunks; adapters are
pluggable, and a Markdown file collection is the only one in the MVP. Event and
conversation sources — including a loop's own history — are future adapters over the
same abstraction. A loop-to-index attachment makes an index available to a loop and
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

A source document is split into overlapping chunks, each embedded independently and each
carrying a backtrack to its exact origin:

- Chunks are sized to the embedding input and overlap their neighbors, so a passage
  split across a boundary still appears whole in at least one chunk.
- Each chunk records its lineage — for the Markdown source, the file path and the
  character span (`startOffset`, `endOffset`) it was cut from, plus its ordinal in the
  file. Lineage makes every retrieved chunk traceable to its source location and citable
  back to it.
- Ingestion is idempotent on a chunk's stable identity, so re-running it never
  double-inserts.

Because chunks overlap, a single relevant passage can surface as two adjacent chunks;
the MVP returns both (recurrence is itself a signal) and defers merge or deduplication.

## Ingestion and rebuild

Ingestion is out-of-band: it is never fired from within loop event handling, so it
cannot affect any event outcome. An adapter normalizes its source into chunks that the
shared pipeline redacts, embeds, and idempotently upserts.

- `rebuild` re-projects the whole source: it walks the corpus, chunks each document,
  embeds, and upserts. A per-document content hash lets `rebuild` skip unchanged
  documents cheaply.
- The Markdown source is treated as a snapshot: `rebuild` is the update path, and the
  index is eventually consistent with the files. Live file-watching and incremental
  supersession are a future capability.
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
- The Markdown source carries no event-timeline position, so retrieval applies no as-of
  filter; a future event or conversation source, whose entries are ordered against the
  loop timeline, would reintroduce as-of ordering.

## Index configuration

Configuration lives in two places: the index itself — source, embedding model, chunking
parameters — on the `ragIndex` record, and how a loop consumes an attached index on the
attachment. Changes are audited (actor, timestamp, prior and new value), consistent with
[llm-harness.md](./llm-harness.md).

- `source`: the corpus the index projects; for the Markdown adapter, the file collection
  to ingest.
- `chunking`: chunk size and overlap.
- `embedding`: `providerRef`, `model`, and `modelVersion`. The MVP pins a concrete model
  and dimension; see
  [rag-index.plan.md](../implementation-plans/rag-index.plan.md).

Lifecycle: retrieval is opt-in — a loop has no index until an admin enables it, which
creates the index over its source, attaches it, and rebuilds from the source. Disabling
detaches the index and removes its entries. Changing the embedding model or chunking
parameters invalidates existing vectors and requires an admin-triggered `rebuild` that
exposes a rebuilding status; Athena never mixes vectors across model versions.

## Failure handling

- Retrieval failures are tool execution failures, recorded per
  [tool-usage.md](./tool-usage.md); a failed lookup returns no context and the persona
  proceeds without it.
- Ingestion failure leaves the source intact — the files remain canonical — and the
  index is repaired by a later `rebuild`.
- Embedding uses the loop provider contract and inherits its availability and failover
  behavior in [llm-harness.md](./llm-harness.md).

## The Markdown file collection as the first source

The first source, and the example implementation of the abstraction, is a collection of
Markdown files — a reference knowledge base a loop can consult. It is deliberately chosen
to showcase the general capability: documents are the archetypal RAG source and exercise
the chunking, overlap, and lineage that a record-oriented source would not.

- Source: a set of Markdown files, treated as a snapshot and (re)projected by `rebuild`.
- Chunks: overlapping windows of each file's text, with `filePath` and character-span
  lineage for backtrack and citation.
- Consumer: any index-enabled persona, through the index's lookup tool; the routing
  persona in [theloop.md](./theloop.md) is one such consumer, not a privileged one.
- Scope: the index is attached only to the loop that enabled it, so retrieval is strictly
  loop-scoped.

## Future directions

- Event and conversation adapters over the same abstraction — including a loop's own
  history as retrievable memory — with event-timeline as-of ordering.
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
- Embedding provider contract:
  [openai-api-connection.plan.md](../implementation-plans/openai-api-connection.plan.md)
- Non-functional requirements: [nfr.md](./nfr.md)
