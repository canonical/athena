# RAG Index Definition

## Summary

A RAG index gives Athena's personas awareness of more information than fits in their
context window: it holds a body of data as retrievable entries and, when a decision
is made, injects the most relevant slice into the persona that needs it. The index
is a standalone entity that a loop attaches; the first data source is a loop's own
event log, which gives the engineering manager memory of the loop's history. This
document defines the general capability first, then that first source.

## Problem

Personas are LLM agents and decide from a bounded context window, but the
information relevant to a decision routinely exceeds it — a loop's accumulated
history today, other bodies of knowledge later. Athena has no way to make a persona
aware of what it cannot hold in context, so decisions are made on whatever fits.

Concretely: Athena routes every event through the engineering manager persona (see
[theloop.md](./theloop.md)), which picks the next owner from the event, the persona
roster, and the persona definitions — with no view of what the loop has already
done. The history is in the event log; it just isn't retrievable when the decision
is made.

## The capability

A RAG index is a first-class, standalone entity over a pluggable data source. A loop
gains awareness of a body of data by attaching an index, and retrieves through the
indexes attached to it.

It is a context input only: it never changes ownership, routing authority, or
approvals defined in [theloop.md](./theloop.md). It is deterministic, auditable,
replayable, opt-in per loop, and governed by loop administrators under the same model
as harness and provider settings in [llm-harness.md](./llm-harness.md); Athena
remains deterministic orchestration code. Better recall may reduce redundant work as
a side effect, but that is not a goal — Athena does not deduplicate or short-circuit
execution, and such optimizations are out of scope.

## Index model and sources

An index owns its data source, embedding model, and ingestion, update, and reindex
procedures. A source adapter turns one source type into indexable entries; adapters
are pluggable, and the loop event log is the only one in the MVP. Documents and
external systems are future adapters over the same abstraction. A loop-to-index
attachment makes an index available to a loop and carries that loop's assembly
settings for it.

Isolation follows attachment: a loop retrieves only through its own attachments, and
retrieval never reaches an index the loop has not attached. Attaching an index to
more than one loop (sharing) requires authorized, audited attachment and is out of
scope for the MVP; see
[The loop event log as the first data source](#the-loop-event-log-as-the-first-data-source)
for what the MVP permits.

## The index is a derived projection

The index is a derived projection over its source, never the canonical record. It
holds two tiers:

1. Source entries (raw) — the projected source data, ingested automatically; the only
   tier in the MVP.
2. Curated entries (additive, future) — knowledge personas intentionally commit; see
   [Curated writes](#curated-writes-future).

Because it is derived:

- It must be fully rebuildable from its canonical sources (the source data, and Tier
  2 commit events when enabled), and nothing enters it except through a logged source
  record.
- Configuration changes are re-projections, not data migrations.
- Rebuildability is per-source: an Athena-owned source (the loop event log) is fully
  rebuildable; a future external source is rebuildable only from its own origin.

## Ingestion

An adapter normalizes its source into ingestible units, which the shared pipeline
redacts, embeds, and idempotently upserts. A unit carries:

- `sourceRef`: stable identifier in the source; drives idempotent upsert.
- `text`: the projected content to embed.
- `orderKey`: the as-of anchor in the source's own timeline.
- `provenance`: source-specific metadata.

`enumerate(cursor)` is the backfill primitive; because ingestion is idempotent,
re-enumeration never double-inserts. Each adapter also defines its own incremental
trigger for newly settled data (the loop event log's is below). Ingestion must not
persist secrets, since index content is re-surfaced into persona context.

## Determinism and replay

- Index entries are append-only with monotonic ordering.
- Retrieval for an event is evaluated as-of that event's position; it must not surface
  entries created after the event it serves.
- The retrieved set is snapshotted into the event's execution context so replay reuses
  it rather than re-querying a changed index — assembly into the assembled-context
  record, pull into its tool execution record per [tool-usage.md](./tool-usage.md).
  This keeps past replay exact across configuration changes.

## Access modes

An index is consumed two ways, and access is enabled per persona:

1. Assembly — Athena assembles a bounded context window and injects it when routing an
   event to a persona with access, primarily the engineering manager at the routing
   decision in [theloop.md](./theloop.md). Assembly is orchestration context assembly
   and needs no tool.
2. Pull — a persona requests entries through the `Retrieve` tool in
   [tool-usage.md](./tool-usage.md), governed by the per-loop tool allow/deny list.
   Pull is a later addition; the MVP uses assembly only.

Index configuration governs the substrate, ingestion, and assembly; the pull and
write tools are governed by the tool allow/deny list. The output is a bounded,
ordered list of context strings injected into the persona's prompt and snapshotted
per the rules above.

## Index configuration

Configuration lives in two places: the index itself — source, embedding model,
ingestion — on the `ragIndex` record, and how a loop consumes an attached index —
assembly settings — on the attachment. Changes are audited (actor, timestamp, prior
and new value), consistent with [llm-harness.md](./llm-harness.md).

- `ingestion.recordKinds`: which settled source record kinds enter the index;
  defaults are source-specific (see below).
- `assembly` (on the attachment): `inject`, a bounded size (`maxEntries` or token
  budget), and ranking. The MVP ranks by semantic similarity only, tie-broken by
  `orderKey` then entry id; recency, kind weighting, and grouping are deferred, but
  entry metadata is stored so they can be added later without re-indexing.
- `embedding`: `providerRef`, `model`, and `modelVersion`. The MVP pins a concrete
  model and dimension; see
  [rag-index.plan.md](../implementation-plans/rag-index.plan.md).
- `retention` (future): retention and compaction for long-lived indexes.
- `curatedWrites` (future): enables Tier 2 commits; see
  [Curated writes](#curated-writes-future).

Lifecycle: retrieval is opt-in — a loop has no index until an admin enables it, which
creates the index over its source, attaches it, and backfills from the source.
Disabling detaches the index and removes or deactivates its entries. Changing the
embedding model invalidates existing vectors and requires an explicit,
admin-triggered re-index that exposes a rebuilding status; Athena never mixes vectors
across model versions.

## Failure handling

- Index failures are handled inside the RAG subsystem and recorded in its audit
  trail. Because the MVP assembles context during routing rather than through a tool,
  failures are not tool executions; the `Retrieve` tool path, once added, would record
  failed tool executions per [tool-usage.md](./tool-usage.md).
- Index failure never changes event ownership: an ingestion failure leaves the source
  intact, and a retrieval or embedding failure assembles no context and routing
  proceeds without it.
- Embedding uses the loop provider contract and inherits its availability and failover
  behavior in [llm-harness.md](./llm-harness.md).

## Curated writes (future)

Curated entries let a persona commit distilled knowledge, an additive layer on the
same index and retrieval engine.

- A commit is a side-effecting step recorded as a tool execution event, so the index
  stays rebuildable from the log, and its payload is Zod-validated and versioned before
  persistence per [llm-harness.md](./llm-harness.md).
- Entries are append-only: updates are new entries that supersede prior ones, never
  edits in place. Each carries provenance (author persona, source event), a `kind`,
  and a confidence signal so retrieval can down-weight low-confidence or superseded
  knowledge.
- Writes redact secrets and suppress near-duplicate commits.
- The tool catalog in [tool-usage.md](./tool-usage.md) is read-side only today;
  curated writes require adding a commit tool contract to it.

## The loop event log as the first data source

The first data source is a loop's own event log. Applying an index here is loop
memory: it gives the engineering manager awareness of the loop's history to improve
its routing decisions — the goal of this first application, with the engineering
manager at the routing decision as the primary consumer.

- Tier: the raw tier is the canonical, append-only event log Athena already persists —
  always present, and the basis for backtracking, audit, and replay. The MVP indexes
  this tier only.
- Immutability and trigger: the index is immutable — entries are appended at event
  settlement and never change. Loop event handling fires the index at the very end of
  handling a settled event (`completed` or `blocked`); the index reads the event from
  Postgres and appends it. Firing after the event is fully handled means the update,
  and any failure in it, cannot affect the event outcome. Indexing changing data is a
  separate future index type with its own update semantics.
- Record kinds: `ingestion.recordKinds` defaults to settled records that serve the
  goal — routing decisions and outcomes, research findings, successful tool result
  summaries, event context, completion summaries, and blocked-handoff reasons; the MVP
  indexes whatever subset the current event sources produce, and excludes in-flight
  chatter and intermediate deliberation. `provenance` carries the origin persona
  (`event.emittedByPersona`), so both chat-visible and internal events are indexed and
  distinguishable.
- Fit: this source suits event-source-driven loops (webhook and other automated
  sources), where each event is self-contained and can be indexed and queried
  individually. It is not for user-heavy chat loops, whose events are conversational
  fragments; admins leave it off there.
- Access: the intended consumers are the OpenAI API-compatible runtime personas in
  [llm-harness.md](./llm-harness.md); coding harness personas (IC and CR) are off by
  default and manage their own context, though their outcomes still enter the index.
- Scope: the index is attached only to the loop it sources, so retrieval is strictly
  loop-scoped. Human-managed governance is out of scope, and decision-quality impact
  is judged retrospectively from the retrieved-set snapshot and audit trail — no
  evaluation harness in the initial capability.

## Cross references

- Loop ownership, membership, and deterministic context assembly:
  [theloop.md](./theloop.md)
- Event entity, replay, and idempotency requirements: [event.md](./event.md)
- Tool execution records and tool allow/deny policy: [tool-usage.md](./tool-usage.md)
- Provider configuration, validation, and availability:
  [llm-harness.md](./llm-harness.md)
- Embedding provider contract:
  [openai-api-connection.plan.md](../implementation-plans/openai-api-connection.plan.md)
- Non-functional requirements: [nfr.md](./nfr.md)
