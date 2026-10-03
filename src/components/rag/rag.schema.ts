import type { QueryExecutor } from "@components/postgres/postgres.js";
import type { TaskQueueItem } from "@components/task/task.schema.js";
import { isoDateTime, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const ragIndexLifecycleStatuses = [`rebuilding`, `ready`, `failed`] as const;

export const ragIndexAliasSchema = z
  .string()
  .trim()
  .min(1, `index must be a non-empty loop-local alias.`)
  .max(64, `index alias must be at most 64 characters.`)
  .regex(/^[a-z][a-z0-9-]*$/u, `index alias must start with a letter and contain only lowercase letters, numbers, and hyphens.`);

export const ragIndexSchema = z.object({
  id: uuid(),
  provider: uuid(),
  providerDisplayName: z.string(),
  embeddingModel: z.string(),
  embeddingDimension: z.number().int().positive().nullable(),
  sourceStrategy: z.string(),
  sourceRef: z.string().trim().min(1),
  segmentationStrategy: z.string(),
  lifecycleStatus: z.enum(ragIndexLifecycleStatuses),
  sourceCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  projectedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  rebuildStartedAt: isoDateTime.nullable(),
  rebuildCompletedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const ragEmbeddingProviderOptionSchema = z.object({
  provider: uuid(),
  displayName: z.string(),
  defaultModel: z.string().nullable(),
  models: z.array(z.string()),
});

export const ragIndexStateSchema = z.object({
  index: ragIndexSchema.nullable(),
  embeddingProviders: z.array(ragEmbeddingProviderOptionSchema),
  currentUserIsAdmin: z.boolean(),
});

export const ragIndexConfigureSchema = z.object({
  provider: uuid(`provider must be a valid UUID.`),
  embeddingModel: requiredString(`embeddingModel is required.`),
});

export type RagIndex = z.infer<typeof ragIndexSchema>;
export type RagIndexState = z.infer<typeof ragIndexStateSchema>;
export type RagEmbeddingProviderOption = z.infer<typeof ragEmbeddingProviderOptionSchema>;
export type RagIndexConfigure = z.infer<typeof ragIndexConfigureSchema>;
export type RagIndexConfigureResult = { status: `configured`; index: RagIndex; buildRequired: boolean } | { status: `active` } | { status: `providerUnavailable` } | { status: `notFound` } | { status: `forbidden` };

export type RagEntryWrite = {
  ragIndex: string;
  ragRecordSource: string;
  sourceKind: string;
  sourceType: string;
  sourceId: string;
  logicalRef: string | null;
  segmentKey: string;
  segmentOrdinal: number;
  text: string;
  provenance: Record<string, unknown>;
  occurredAt: string | Date;
  embedding: number[];
};

export type RagLookupHit = {
  id: string;
  sourceKind: string;
  sourceType: string;
  sourceId: string;
  logicalRef: string | null;
  segmentKey: string;
  segmentOrdinal: number;
  text: string;
  provenance: Record<string, unknown>;
  occurredAt: string;
  similarity: number;
};

export type RagEmbeddingRequest = {
  connection: { baseUrl: string; apiKey: string };
  model: string;
  texts: string[];
  operation: string;
  idempotencyKey?: string;
};

export type RagEntryLookup = {
  executor: QueryExecutor;
  ragIndex: string;
  embedding: number[];
  limit: number;
};

export type RagRetrievalRequest = Omit<RagEmbeddingRequest, "texts"> & {
  executor: QueryExecutor;
  ragIndex: string;
  query: string;
  limit: number;
};

export type RagIndexResolution = {
  ragIndex: string;
  lifecycleStatus: (typeof ragIndexLifecycleStatuses)[number];
  sourceStrategy: string;
  sourceRef: string;
  segmentationStrategy: string;
  provider: string;
  embeddingModel: string;
  embeddingDimension: number | null;
};

export const ragRecordKinds = [`taskMessage`, `toolDecision`, `toolResult`, `runnerResult`] as const;
export type RagRecordKind = (typeof ragRecordKinds)[number];
export const ragRecordSourceTypes = [`taskQueueItem`, `toolCall`, `runnerCall`] as const;
export type RagRecordSourceType = (typeof ragRecordSourceTypes)[number];

export type RagRecordSourceWrite = {
  loop: string;
  sourceType: RagRecordSourceType;
  sourceId: string;
  recordKind: RagRecordKind;
  logicalRef: null;
  text: string;
  provenance: Record<string, unknown>;
  contentHash: string;
  originalByteCount: number;
  truncated: boolean;
  occurredAt: string;
};

export type RagTaskQueueItemRenderInput = {
  loop: string;
  task: string;
  taskTitle: string | null;
  queueItem: TaskQueueItem;
  kind?: RagRecordKind;
};

export type RagBuildSourceRecord = RagTaskQueueItemRenderInput & {
  taskOrdinal: number;
};

export type RagRecordProjection = {
  id: string;
  ragIndex: string;
  ragRecordSource: string;
  status: `pending` | `projected` | `skipped` | `failed`;
  error: string | null;
  sourceKind: RagRecordKind;
  sourceType: RagRecordSourceType;
  sourceId: string;
  logicalRef: string | null;
  text: string;
  provenance: Record<string, unknown>;
  occurredAt: Date;
};

export type RagRecordProjectionReference = Pick<RagRecordProjection, `id` | `ragIndex` | `ragRecordSource`>;

export type RagIndexEmbeddingTarget = {
  loop: string;
  provider: string;
  embeddingModel: string;
};
