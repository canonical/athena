# RAG Index Definition

## Purpose

A RAG index is a standalone semantic retrieval object. It owns a source projection,
segmentation behavior, embedding contract, retrieval behavior, lifecycle, and entries.
Consumers access indexes through common lookup infrastructure rather than index-kind-specific
tools.

Loop self-memory is the first index kind, not the base abstraction. It projects selected
activity from one loop, but reusable document, repository, workgraph, and other index kinds
must fit the same common infrastructure.

## Common index model

`ragIndex` owns only concerns shared by every index:

- Stable identity and index kind.
- Immutable source/reference and segmentation descriptors.
- Embedding provider, model, and discovered vector dimension.
- Lifecycle, rebuild progress, and diagnostics.

The base index does not contain a loop foreign key. It stores generic source and
segmentation descriptors, and index-kind services validate source ownership.
This prevents loop self-memory from defining the shape of future standalone indexes.

`ragIndex.sourceRef` is the source projection's immutable top-level locator. For
`loopActivity` it is the source loop UUID; a future HTTP API source could store its URL.
For loop activity, server transactions validate the loop source and serialize configuration
by loop. This value is distinct from the `sourceType` and `sourceId` identity stored by a
`ragRecordSource` and copied to its projected entry.

Configuration is immutable in the current scope. Enabling memory creates an index and
immediately starts its background build. Users do not manage routine build transitions, but
loop admins may request an idempotent scan and repair when work is missing or failed.
Changing source, segmentation, embedding provider, or model requires removing the existing
index and enabling a new one.

## Index kinds and ownership

The first kind is `loopActivity`:

- Its `sourceRef` is the source loop UUID.
- Server transactions maintain at most one self-memory index per loop.
- It is loop-owned and non-detachable.
- Deleting its source loop explicitly deletes its self-memory `ragIndex` in the same
   transaction.
- Removing it deletes the index, its entries and projections, and the loop's RAG source
   records.

Future standalone indexes may add owner-scoped kind tables when their ownership model
requires them and may be attached to loops.
Standalone discovery, sharing authorization, and attachment CRUD are deferred, but the base
schema must not prevent them. Deleting a loop removes those attachments but does not delete
the reusable indexes.

Loop-scoped API routes only resolve or enable the loop's self-memory attachment. Once an
index exists, lifecycle operations address the index resource by `ragIndex.id`, for example
`/rag/:index/repair`, and authorize according to that index kind's ownership model. Index
repair, removal, and future index operations must not use a loop identifier as the resource
identity.

A provider cannot be deleted while any `ragIndex` references it. Provider deletion reports
the IDs of loops whose indexes use it. A provider assignment cannot be removed from a loop
while that loop's current index uses it.

## Loop-local aliases and lookup

Consumers address one index at a time through a loop-local alias. The universal lookup tool
accepts an alias, query, and optional result bound, resolves exactly one index, and runs the
fixed retrieval pipeline.

The reserved alias `self` resolves directly to the loop's `loopActivity` `ragIndex`; it does
not require a general attachment row. Future reusable indexes use a loop attachment table
with a unique alias per loop. Attachment lifecycle controls loop access only and must not
change or delete a shared index. Index lifecycle controls projection and storage.

## Pipeline behavior

The common pipeline has these stages:

1. **Source projection** belongs to the index kind and emits typed source records with stable
   identity, occurrence time, text, and safe provenance.
2. **Segmentation** maps one source record to one or more ordered segments. Loop activity
   uses `wholeEntry`, which preserves the complete bounded source record as one segment with
   key `whole` and ordinal `0`.
3. **Embedding** maps segment text to vectors through the fixed provider implementation.
   One index has exactly one provider, model, and vector dimension.
4. **Retrieval** embeds a query, selects and ranks entries, applies stable tie-breaking, and
   returns safe result metadata. Initial retrieval is exact cosine similarity.
5. **Storage** uses Athena's default RAG entry repository. It owns all PostgreSQL vector SQL;
   source projection, retrieval, and tool execution do not embed storage queries.

Source and segmentation descriptors are part of immutable index configuration. The current
loop-activity kind fixes them to `loopActivity` and `wholeEntry`; they are not runtime
strategy selections. Introduce an abstraction only when a second implemented projection
requires one. Embedding remains a modular contract but is not persisted as an index choice.
Retrieval and storage are fixed services.

The implemented fixed services are:

- `provider` embedding is fixed and sends ordered text batches through the index's configured
   OpenRouter-compatible provider and model.
- Default retrieval embeds one query, then delegates bounded ranking to the entry repository.
- Default storage owns entry upsert and vector-distance SQL. Its current ranking
   implementation uses exact cosine similarity.

The storage boundary accepts writes only while the index is `rebuilding` or `ready`. The
first vector establishes `embeddingDimension`; later vectors must match it. Lookup requires
a `ready` index and a query vector with the same dimension.

Phase 2 maps canonical loop activity to provider-independent `ragRecordSource` records while
an index exists. Enabling an index scans canonical history to create sources; later activity
creates sources transactionally. Each source receives a `ragRecordProjection` row, and the
background worker maps pending projections into the common entry shape. It preserves each
source record as one bounded segment with key `whole` and ordinal `0` before embedding and
storage.

## Rebuilds and entries

`ragIndex` owns its embedding contract, rebuild lifecycle, progress, and failure
diagnostics. There is no generation entity or retained copy of derived data.

Enabling creates an index in `rebuilding` and queues its build in the same application
operation. The background build maps canonical source state into source records, projections,
and entries. Only a `ready` index participates in lookup. Build work is serialized per index,
and workers must verify the expected lifecycle before every write. A build never mixes
embedding contracts because changing provider, model, source, or segmentation requires
removing the old index and enabling a new one.

The current temporary compatibility policy deliberately has no rebuild revision. If a
deployment cannot trust an existing index format or rebuild state, it purges and re-creates
the index so subsequent work targets a new index identity.

`ragRecordSource` is the append-only, provider-independent source of indexable records. Its
source identity is stored as separate `sourceType` and `sourceId` fields and is unique across
the source registry. `ragRecordProjection` owns the status and diagnostics for projecting one
source record into one index; its index/source pair is unique.

`ragEntry` is source-neutral segmented output:

- Index.
- Source identity and occurrence timestamp.
- Segment identity/ordinal.
- Bounded redacted text and safe provenance.
- Optional logical identity and supersession state.
- Vector storage owned by the repository implementation.

Entry identity includes index, source record, and segment identity. Repeated content from
different source entities is valid.

## Loop activity specialization

The loop activity kind observes task messages, task state, tool decisions/results, runner
results, and curated workgraph state. Operational processor/routing churn and raw provider
payloads are excluded.

Messages are additive. Mutable task/workgraph state uses logical identity and supersession.
Before persistence, source records are redacted and bounded to one UTF-8-safe 8 KiB source
record. `wholeEntry` then preserves that record as one entry without further splitting.

Source-record and live-projection insertion is transactional with canonical domain mutation.
Source records are persisted only while the loop has an index. Enabling or repairing an index
scans canonical task history to reconstruct missing source records and projections. Versioned
background jobs perform build and projection. Job payloads contain only index or projection
identity, never content or credentials. Loop admins may explicitly queue a scan and repair to
retry failed projections and recover transient enqueue gaps.

## Lifecycle

The self-memory lifecycle is `rebuilding | ready | failed`:

- `rebuilding`: canonical history is being scanned and pending content is being projected;
   lookup is unavailable.
- `ready`: the index is queryable and live source records continue projecting.
- `failed`: diagnostics remain; an admin scan and repair retries failed or missing work.

Removing memory deletes the index, projections, entries, and loop RAG source records.
Re-enabling reconstructs canonical history under a new index identity. Scan and repair keeps
valid entries, resets failed projections and projections missing entries, recomputes progress,
and queues a canonical source scan. Jobs verify index lifecycle before every write, and
singleton queue keys prevent duplicate work for an index or projection.

## Security and replay

Every lookup resolves through the calling loop's alias namespace and independently checks
index availability and access. Indexed content is untrusted prompt input. Secrets are
redacted before RAG persistence, and logs/job payloads never contain text, queries, vectors,
or credentials.

Lookup results enter the normal tool-result path. Persisted tool results are replay
snapshots and never re-query the index.

## Cross references

- Background delivery: [background-processing.md](./background-processing.md)
- Provider capability selection: [llm-harness.md](./llm-harness.md)
- Tool policy and replay: [tool-usage.md](./tool-usage.md)
- Implementation plan: [rag-index.plan.md](../implementation-plans/rag-index.plan.md)
