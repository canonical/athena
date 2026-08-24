# Provider Capabilities Implementation Plan

## Objective

Refactor the existing provider definition into one shared connection with explicit chat
and embedder capabilities. A provider may expose chat, embeddings, or both. When it
exposes both, both capabilities use the same owner, provider type, base URL, credential,
and lifecycle configuration.

This plan establishes the embedding boundary required by
[rag-index.plan.md](./rag-index.plan.md). It does not implement RAG storage, ingestion, or
retrieval.

## Decisions

- `provider` remains the owner-scoped aggregate root and the only record that owns
  connection and credential configuration.
- `providerChat` and `providerEmbedder` are optional one-to-one provider capabilities.
- A provider must have at least one capability.
- Existing providers migrate with a chat capability and no embedder capability.
- `loopProvider` is a chat assignment and may reference only a provider with a chat
  capability.
- A future `ragIndex` references the provider's embedder capability directly. Embedders
  do not participate in loop chat-provider selection or failover.
- Shared provider changes apply to both capabilities. Capability-specific model settings
  do not leak into the other capability.
- TypeScript behavior is separated into `ProviderChat` and `ProviderEmbedder` classes.
  Both receive the same resolved provider connection instead of duplicating connection
  ownership or secrets.

## Shared provider definition

The existing `provider` record retains:

- `id`, `owner`, and `displayName`;
- `providerType`;
- `baseUrl`;
- encrypted credential envelope fields;
- `lifecycleStatus`; and
- timestamps.

`defaultModel` and `enabledModels` move into the chat capability as the application source
of truth. The legacy provider columns remain temporarily as a rollback-compatible mirror;
chat creation, updates, and removal keep both representations synchronized. Plaintext
credentials remain available only through internal connection resolution and never appear
in API responses.

## Capability definitions

### `providerChat`

One optional row per provider:

- `provider` UUID primary key and foreign key to `provider`, with cascade delete;
- `defaultModel` nullable text;
- `enabledModels` nullable text array; and
- timestamps.

The existing model listing, validation, chat-completion, and loop-selection behavior reads
this capability. Chat model discovery filters out embedding-only models. Removing the
capability is rejected while the provider has loop assignments.

### `providerEmbedder`

One optional row per provider:

- `provider` UUID primary key and foreign key to `provider`, with cascade delete;
- `model` non-empty text;
- timestamps.

The embedder uses `POST <baseUrl>/embeddings` with the shared bearer credential and an
OpenAI-compatible `{ input, model }` body. It orders response items by `data[].index` and
validates the response count and numeric vector values. Verification reports the observed
dimensions but does not treat dimensions as provider configuration. Empty vectors,
inconsistent dimensions within a response, and vectors above Athena's 3,072-dimension
storage limit are rejected. Embedder model discovery, when supported by the provider
catalog, filters out chat-only models.

## Application contracts

The provider API returns the shared definition with nested nullable capabilities:

```json
{
  "id": "...",
  "displayName": "Example provider",
  "providerType": "openrouter",
  "baseUrl": "https://example.invalid/v1",
  "hasCredential": true,
  "lifecycleStatus": "active",
  "chat": {
    "defaultModel": "chat-model",
    "enabledModels": ["chat-model"]
  },
  "embedder": {
    "model": "embedding-model"
  }
}
```

Create and update validate that at least one capability is present. Updates to the shared
connection and both capabilities are transactional. Omitting a capability means it is
disabled; it must not silently retain stale capability configuration.

Internal connection resolution returns the shared base URL and decrypted credential plus
the requested capability configuration. Callers must request either chat or embedder so
an embedding-only provider cannot enter a chat path.

## UI

Keep one Providers section and one provider editor:

- the connection section edits shared name, type, base URL, credential, and lifecycle;
- a Chat capability section enables chat and manages its model settings;
- an Embedder capability section enables embeddings and manages its model; and
- provider lists and details show the enabled capabilities.

The existing Settings tab may contain separate Chat and Embedder panels. Connection
verification for the embedder sends a small real embedding request and reports the
observed dimensions without exposing the credential.

## Current implementation impact

- Provider aggregate: `provider.schema.ts`, `provider.service.ts`,
  `provider.controller.ts`, `provider.router.ts`, `provider.client.ts`, and
  `provider.query.ts`.
- Chat capability consumers: `openrouter.service.ts`, `loop-selection.service.ts`, loop
  readiness queries, task iteration utilities, and the available-model tool.
- Provider UI: editor, list, details, and settings components plus shell routes only if
  capability-specific settings need their own URL.
- Persistence: forward-only provider capability migrations plus `migrate.sql`.
- E2E support: the provider spec and reusable Playwright provider helpers. Embedding
  verification uses the existing deterministic inference service, whose model catalog and
  `/embeddings` route require no scenario registration.

## Migration sequence

1. Add canonical `providerChat` and `providerEmbedder` tables after the current `002300`
   migration.
2. Backfill one `providerChat` row for every existing provider from its current
   `defaultModel` and `enabledModels` values.
3. Keep the existing `loopProvider.provider` foreign key unchanged and enforce chat
   capability eligibility in assignment, readiness, and selection queries.
4. Switch application reads to the capability tables while dual-writing chat changes to
   the legacy provider columns.
5. Keep the legacy columns for rollback safety. Their removal requires a later release
   after the compatibility period ends.

The forward migrations must remain idempotent, must not modify previously published
migration files, and must preserve existing provider ids, assignments, credentials, model
settings, priorities, and selection metrics. A provider created by a rolled-back version is
backfilled on the next forward migration run, while a provider that already has only an
embedder capability must not acquire chat implicitly.

## Implementation sequence

1. Add capability schemas and nested provider API types in `provider.schema.ts`.
2. Add the two capability tables and rollback-compatible backfill migration.
3. Refactor provider persistence so aggregate create/update operations are transactional
   and capability-aware.
4. Move chat-specific connection resolution and behavior behind `ProviderChat`, adapting
   provider selection, task iteration, model settings, readiness, and model-list tools.
5. Add `ProviderEmbedder`, its OpenAI-compatible request/response schemas, and
   connection-verification controller route.
6. Update the provider editor, settings, details, and list UI to expose both capabilities.
7. Update Playwright UI helpers and provider E2E scenarios.
8. Run formatting, static checks, and the complete E2E suite before beginning RAG work.

## E2E scenarios

Per [testing-standards.md](../../testing-standards.md), all setup, actions, and assertions
use the rendered UI. Deterministic inference is reached through normal provider
configuration and networking.

1. Create a chat-only provider and use it in the existing loop/task flow.
2. Create an embedder-only provider, verify it with `deterministic-embed-1536`, and confirm
   it is unavailable in loop chat assignment.
3. Create one provider with both capabilities and confirm both use the same displayed
   connection while retaining independent model settings.
4. Edit shared connection configuration and confirm both capability panels retain their
   settings.
5. Reject a provider with neither capability.
6. Preserve existing credential-redaction, owner-isolation, URL-validation, model
   validation, and loop-assignment scenarios.

## Acceptance criteria

1. One provider can expose chat, embeddings, or both without duplicating its endpoint or
   credential.
2. Chat and embedding code consume explicit capability contracts.
3. Embedder-only providers cannot be assigned to the loop chat pool.
4. Existing providers and loop assignments retain their behavior after migration.
5. Embedding verification uses the real OpenAI-compatible HTTP boundary, validates the
   response structure, and reports observed dimensions.
6. No API response, log, error, or UI state exposes plaintext credentials.
7. Static checks and the complete Playwright suite pass.

## Related specs

- [llm-harness.md](../definitions/llm-harness.md)
- [rag-index.md](../definitions/rag-index.md)
- [openai-api-connection.plan.md](./openai-api-connection.plan.md)
- [rag-index.plan.md](./rag-index.plan.md)
- [testing-standards.md](../../testing-standards.md)
