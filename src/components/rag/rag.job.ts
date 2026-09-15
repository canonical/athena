import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { backendConfig } from "@components/config/backend-config.js";
import { query } from "@components/postgres/postgres.js";
import { z } from "zod";
import { fetchRagIndexEmbeddings } from "./rag.provider-embedding.service.js";
import {
  queryPendingRagRecordProjections,
  queryRagBuildProjectionPage,
  queryRagBuildScanComplete,
  queryRagBuildSourcePage,
  queryRagIndexBuildFailed,
  queryRagRecordProjection,
  queryRagRecordProjectionFailed,
  queryRagRecordProjectionProjected,
  queryRagRecordSourceInsert,
  ragRecordProjectionPageSize,
} from "./rag.record-source.service.js";
import { renderRagTaskQueueItem } from "./rag.render.service.js";
import { ragEntryUpsert } from "./rag.storage.service.js";

const appendPayloadSchema = z.object({ projection: z.uuid() }).strict();
const buildPayloadSchema = z.object({ ragIndex: z.uuid() }).strict();

export const ragEntryAppendJob: BackgroundJobDefinition<z.infer<typeof appendPayloadSchema>> = {
  name: `rag-entry-append`,
  version: 1,
  payloadSchema: appendPayloadSchema,
  queue: { policy: `standard` },
  handler: async ({ job, payload }) => {
    const projection = await queryRagRecordProjection(payload.projection);
    if (projection?.status !== `pending`) return { projected: false };

    try {
      const embeddings = await fetchRagIndexEmbeddings(projection.ragIndex, {
        texts: [projection.text],
        operation: `rag-entry-append`,
        idempotencyKey: projection.id,
      });
      const embedding = embeddings[0];
      if (!embedding) throw new Error(`RAG entry embedding was not returned.`);

      await ragEntryUpsert({ query }, [
        {
          ragIndex: projection.ragIndex,
          ragRecordSource: projection.ragRecordSource,
          sourceKind: projection.sourceKind,
          sourceType: projection.sourceType,
          sourceId: projection.sourceId,
          logicalRef: projection.logicalRef,
          segmentKey: `whole`,
          segmentOrdinal: 0,
          text: projection.text,
          provenance: projection.provenance,
          occurredAt: projection.occurredAt,
          embedding,
        },
      ]);
      await queryRagRecordProjectionProjected(projection.id);
      return { projected: true };
    } catch (error) {
      if (job.retryCount >= backendConfig.backgroundJobs.retryLimit) await queryRagRecordProjectionFailed(projection.id, `Projection failed after retry limit.`);
      throw error;
    }
  },
};

export const ragIndexBuildJob: BackgroundJobDefinition<z.infer<typeof buildPayloadSchema>> = {
  name: `rag-index-build`,
  version: 1,
  payloadSchema: buildPayloadSchema,
  queue: { policy: `standard` },
  handler: async ({ job, payload }) => {
    const { ragIndex: ragIndexId } = payload;
    try {
      let afterTaskId: string | undefined;
      let afterTaskOrdinal = 0;
      for (;;) {
        const records = await queryRagBuildSourcePage(ragIndexId, afterTaskId, afterTaskOrdinal);
        for (const record of records) {
          const source = renderRagTaskQueueItem(record);
          if (source) await queryRagRecordSourceInsert({ query }, source);
        }
        const lastRecord = records.at(-1);
        afterTaskId = lastRecord?.task;
        afterTaskOrdinal = lastRecord?.taskOrdinal ?? 0;
        if (records.length < ragRecordProjectionPageSize) break;
      }

      let created = 0;
      for (;;) {
        const count = await queryRagBuildProjectionPage(ragIndexId);
        created += count;
        if (count < ragRecordProjectionPageSize) break;
      }
      await queryRagBuildScanComplete(ragIndexId);

      let scheduled = 0;
      let afterId: string | undefined;
      for (;;) {
        const projections = await queryPendingRagRecordProjections(ragIndexId, afterId);
        for (const projection of projections) {
          await enqueueRagEntryAppend(projection.id);
        }
        scheduled += projections.length;
        afterId = projections.at(-1)?.id;
        if (projections.length < ragRecordProjectionPageSize) break;
      }
      return { created, scheduled };
    } catch (error) {
      if (job.retryCount >= backendConfig.backgroundJobs.retryLimit) await queryRagIndexBuildFailed(ragIndexId, `Index build failed after retry limit.`);
      throw error;
    }
  },
};

backgroundJobRegister(ragEntryAppendJob);
backgroundJobRegister(ragIndexBuildJob);

export const enqueueRagIndexBuild = (ragIndexId: string) => backgroundJobEnqueue(ragIndexBuildJob, { ragIndex: ragIndexId }, { singletonKey: ragIndexId });
export const enqueueRagEntryAppend = (projectionId: string) => backgroundJobEnqueue(ragEntryAppendJob, { projection: projectionId }, { singletonKey: projectionId });
