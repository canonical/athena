import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";
import { configureRagIndex, removeRagIndex, repairRagIndex } from "./rag.client.js";
import { useRagIndexState } from "./rag.query.js";

export function LoopMemory({ loopId }: { loopId: string }) {
  const queryClient = useQueryClient();
  const [isRepairing, setIsRepairing] = useState(false);
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
        helpers.setStatus(`Memory has been enabled.`);
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
  const repairIndex = async () => {
    if (!index) return;
    formik.setStatus(undefined);
    setIsRepairing(true);
    try {
      await repairRagIndex(index.id);
      await queryClient.invalidateQueries({ queryKey: [`ragIndex`, loopId] });
      formik.setStatus(`Memory scan and repair has been queued.`);
    } catch (repairError) {
      formik.setStatus(repairError instanceof Error ? repairError.message : String(repairError));
    } finally {
      setIsRepairing(false);
    }
  };
  const removeIndex = async () => {
    if (!index) return;
    if (!window.confirm(`Remove this loop's memory and all indexed content?`)) return;
    formik.setStatus(undefined);
    formik.setSubmitting(true);
    try {
      await removeRagIndex(index.id);
      await queryClient.invalidateQueries({ queryKey: [`ragIndex`, loopId] });
      formik.setStatus(`Memory has been removed.`);
    } catch (removeError) {
      formik.setStatus(removeError instanceof Error ? removeError.message : String(removeError));
    } finally {
      formik.setSubmitting(false);
    }
  };

  return (
    <div className="p-card p-strip is-shallow">
      <div className="row">
        <div className="col-9">
          <h2 className="p-heading--4">Memory</h2>
        </div>
        <div className="col-3 u-align--right">
          {data.currentUserIsAdmin && index ? (
            <Button
              appearance="base"
              aria-label={isRepairing ? `Scanning and repairing memory` : `Scan and repair memory`}
              disabled={isRepairing || formik.isSubmitting}
              hasIcon
              title="Scan and repair memory"
              type="button"
              onClick={() => void repairIndex()}
            >
              <i className="p-icon--restart" />
              <span className="u-off-screen">{isRepairing ? `Scanning and repairing memory` : `Scan and repair memory`}</span>
            </Button>
          ) : null}
        </div>
      </div>
      {formik.status ? (
        <Notification
          severity={
            formik.status === `Memory has been enabled.` || formik.status === `Memory has been removed.` || formik.status === `Memory scan and repair has been queued.` ? NotificationSeverity.INFORMATION : NotificationSeverity.NEGATIVE
          }
        >
          {formik.status}
        </Notification>
      ) : null}
      <dl>
        <dt>Index identity</dt>
        <dd id="rag-index-id">{index?.id ?? `Not configured`}</dd>
        <dt>Status</dt>
        <dd id="rag-index-status">{index?.lifecycleStatus ?? `Not configured`}</dd>
        <dt>Embedding provider</dt>
        <dd id="rag-index-provider-name">{index?.providerDisplayName ?? `Not configured`}</dd>
        <dt>Embedding model</dt>
        <dd id="rag-index-embedding-model">{index?.embeddingModel ?? `Not configured`}</dd>
        <dt>Source</dt>
        <dd id="rag-index-source-strategy">{index?.sourceStrategy === `loopActivity` ? `Loop activity` : (index?.sourceStrategy ?? `Not configured`)}</dd>
        <dt>Source reference</dt>
        <dd id="rag-index-source-ref">{index?.sourceRef ?? `Not configured`}</dd>
        <dt>Segmentation</dt>
        <dd id="rag-index-segmentation">{index?.segmentationStrategy === `wholeEntry` ? `Whole entry` : (index?.segmentationStrategy ?? `Not configured`)}</dd>
        <dt>Source records</dt>
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
          {index ? (
            <div className="u-align--right">
              <Button appearance="negative" disabled={formik.isSubmitting || isRepairing} onClick={() => void removeIndex()} type="button">
                Remove memory
              </Button>
            </div>
          ) : (
            <>
              <label htmlFor="rag-index-provider">Embedding provider</label>
              <select
                id="rag-index-provider"
                disabled={formik.isSubmitting}
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
              <select id="rag-index-model" disabled={!selectedProvider || formik.isSubmitting} {...formik.getFieldProps(`embeddingModel`)}>
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
                  {formik.isSubmitting ? `Enabling...` : `Enable memory`}
                </Button>
              </div>
            </>
          )}
        </form>
      ) : (
        <p>Only loop admins may change memory configuration.</p>
      )}
    </div>
  );
}
