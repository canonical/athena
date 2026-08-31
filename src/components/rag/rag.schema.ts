import type { QueryExecutor } from "@components/postgres/postgres.js";
import { isoDateTime, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const ragIndexLifecycleStatuses = [`disabled`, `rebuilding`, `ready`, `failed`] as const;

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
export type RagIndexConfigureResult = { status: `configured`; index: RagIndex } | { status: `active` } | { status: `providerUnavailable` } | { status: `notFound` } | { status: `forbidden` };

export type RagEntryWrite = {
  ragIndex: string;
  sourceKind: string;
  sourceRef: string;
  logicalRef: string | null;
  segmentKey: string;
  segmentOrdinal: number;
  text: string;
  provenance: Record<string, unknown>;
  occurredAt: string;
  embedding: number[];
};

export type RagLookupHit = {
  id: string;
  sourceKind: string;
  sourceRef: string;
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
