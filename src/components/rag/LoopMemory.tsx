import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { configureRagIndex } from "./rag.client.js";
import { useRagIndexState } from "./rag.query.js";

export function LoopMemory({ loopId }: { loopId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useRagIndexState(loopId);
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      provider: data?.index?.provider ?? data?.embeddingProviders[0]?.provider ?? ``,
      embeddingModel: data?.index?.embeddingModel ?? data?.embeddingProviders[0]?.defaultModel ?? data?.embeddingProviders[0]?.models[0] ?? ``,
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined);
      try {
        await configureRagIndex(loopId, values);
        await queryClient.invalidateQueries({ queryKey: [`ragIndex`, loopId] });
        helpers.setStatus(`Memory configuration has been saved.`);
      } catch (submitError) {
        helpers.setStatus(submitError instanceof Error ? submitError.message : String(submitError));
      }
    },
  });

  if (isPending) return <p>Loading memory...</p>;
  if (isError || !data)
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load memory">
        {error instanceof Error ? error.message : String(error)}
      </Notification>
    );

  const selectedProvider = data.embeddingProviders.find((provider) => provider.provider === formik.values.provider);
  const index = data.index;

  return (
    <div className="p-card p-strip is-shallow">
      <h2 className="p-heading--4">Memory</h2>
      {formik.status ? <Notification severity={formik.status === `Memory configuration has been saved.` ? NotificationSeverity.INFORMATION : NotificationSeverity.NEGATIVE}>{formik.status}</Notification> : null}
      <dl>
        <dt>Index identity</dt>
        <dd id="rag-index-id">{index?.id ?? `Not configured`}</dd>
        <dt>Status</dt>
        <dd id="rag-index-status">{index?.lifecycleStatus ?? `Not configured`}</dd>
        <dt>Source</dt>
        <dd id="rag-index-source-strategy">{index?.sourceStrategy === `loopActivity` ? `Loop activity` : (index?.sourceStrategy ?? `Not configured`)}</dd>
        <dt>Source reference</dt>
        <dd id="rag-index-source-ref">{index?.sourceRef ?? `Not configured`}</dd>
        <dt>Segmentation</dt>
        <dd id="rag-index-segmentation">{index?.segmentationStrategy === `wholeEntry` ? `Whole entry` : (index?.segmentationStrategy ?? `Not configured`)}</dd>
        <dt>Source observations</dt>
        <dd id="rag-index-source-count">{index?.sourceCount ?? 0}</dd>
        <dt>Pending</dt>
        <dd id="rag-index-pending-count">{index?.pendingCount ?? 0}</dd>
        <dt>Projected</dt>
        <dd id="rag-index-projected-count">{index?.projectedCount ?? 0}</dd>
        <dt>Skipped</dt>
        <dd id="rag-index-skipped-count">{index?.skippedCount ?? 0}</dd>
        <dt>Failed</dt>
        <dd id="rag-index-failed-count">{index?.failedCount ?? 0}</dd>
        <dt>Last error</dt>
        <dd id="rag-index-last-error">{index?.lastError ?? `None`}</dd>
      </dl>
      {data.currentUserIsAdmin ? (
        <form onSubmit={formik.handleSubmit}>
          <label htmlFor="rag-index-provider">Embedding provider</label>
          <select
            id="rag-index-provider"
            disabled={formik.isSubmitting || (index !== null && index.lifecycleStatus !== `disabled`)}
            value={formik.values.provider}
            onChange={(event) => {
              const provider = data.embeddingProviders.find((option) => option.provider === event.target.value);
              void formik.setFieldValue(`provider`, event.target.value);
              void formik.setFieldValue(`embeddingModel`, provider?.defaultModel ?? provider?.models[0] ?? ``);
            }}
          >
            <option value="">Select an embedding provider</option>
            {data.embeddingProviders.map((provider) => (
              <option key={provider.provider} value={provider.provider}>
                {provider.displayName}
              </option>
            ))}
          </select>
          <label htmlFor="rag-index-model">Embedding model</label>
          <select id="rag-index-model" disabled={!selectedProvider || formik.isSubmitting || (index !== null && index.lifecycleStatus !== `disabled`)} {...formik.getFieldProps(`embeddingModel`)}>
            <option value="">Select an embedding model</option>
            {selectedProvider?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {data.embeddingProviders.length === 0 ? <p>No assigned embedding-capable provider is available.</p> : null}
          <div className="u-align--right">
            <Button appearance="positive" disabled={!formik.values.provider || !formik.values.embeddingModel || formik.isSubmitting} type="submit">
              {formik.isSubmitting ? `Saving...` : `Save memory configuration`}
            </Button>
          </div>
        </form>
      ) : (
        <p>Only loop admins may change memory configuration.</p>
      )}
    </div>
  );
}
