import { query } from "@components/postgres/postgres.js";
import type { RagEmbeddingProviderOption, RagIndex, RagIndexResolution } from "./rag.schema.js";

const ragIndexColumns = `ri."id", ri."provider", p."displayName" AS "providerDisplayName", ri."embeddingModel", ri."embeddingDimension", ri."sourceStrategy", ri."sourceRef", ri."segmentationStrategy", ri."lifecycleStatus", ri."sourceCount", ri."pendingCount", ri."projectedCount", ri."skippedCount", ri."failedCount", ri."lastError", ri."rebuildStartedAt", ri."rebuildCompletedAt", ri."createdAt", ri."updatedAt"`;
const ragIndexRelations = `JOIN "provider" p ON p."id" = ri."provider"`;

export const queryRagIndexByLoop = async (loopId: string): Promise<RagIndex | undefined> => {
  const result = await query<RagIndex>(
    `SELECT ${ragIndexColumns}
     FROM "ragIndex" ri
     ${ragIndexRelations}
     WHERE ri."kind" = 'loopActivity'
       AND ri."sourceRef" = $1`,
    [loopId],
  );

  return result.rows[0];
};

export const queryRagIndexByAlias = async (loopId: string, alias: string): Promise<RagIndexResolution | undefined> => {
  if (alias !== `self`) {
    return undefined;
  }

  const result = await query<RagIndexResolution>(
    `SELECT
       ri."id" AS "ragIndex",
       ri."lifecycleStatus",
       ri."sourceStrategy",
       ri."sourceRef",
       ri."segmentationStrategy",
       ri."provider",
       ri."embeddingModel",
       ri."embeddingDimension"
     FROM "ragIndex" ri
     WHERE ri."kind" = 'loopActivity'
       AND ri."sourceRef" = $1`,
    [loopId],
  );

  return result.rows[0];
};

export const queryRagEmbeddingProviderOptions = async (loopId: string): Promise<RagEmbeddingProviderOption[]> => {
  const result = await query<RagEmbeddingProviderOption>(
    `SELECT
       p."id" AS "provider",
       p."displayName",
       p."embeddingDefaultModel" AS "defaultModel",
       p."embeddingEnabledModels" AS "models"
     FROM "loopProvider" lp
     JOIN "provider" p ON p."id" = lp."provider"
     WHERE lp."loop" = $1
       AND lp."enabled" = TRUE
       AND p."lifecycleStatus" = 'active'
       AND p."providerType" = 'openrouter'
       AND COALESCE(array_length(p."embeddingEnabledModels", 1), 0) > 0
     ORDER BY COALESCE(lp."priorityOverride", lp."priority"), lp."createdAt", lp."provider"`,
    [loopId],
  );

  return result.rows;
};
