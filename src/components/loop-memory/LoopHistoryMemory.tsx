import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useProviderList } from "@components/provider/provider.query.js";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { updateLoopMemoryConfig } from "./loop-memory.client.js";
import { useLoopMemoryConfig } from "./loop-memory.query.js";
import type { LoopMemoryConfigUpdate } from "./loop-memory.schema.js";

type Props = {
  canEdit: boolean;
  loopId: string;
};

export function LoopHistoryMemory({ canEdit, loopId }: Props) {
  const [feedback, setFeedback] = useState<{ error?: string; saved?: boolean }>({});
  const { data, isPending, isError, error, reload } = useLoopMemoryConfig(loopId);
  const { state: providerState } = useProviderList();
  const embedders = providerState.status === `success` ? providerState.providers.filter((provider) => provider.lifecycleStatus === `active` && provider.embedder !== null) : [];
  const formik = useFormik<LoopMemoryConfigUpdate>({
    initialValues: { hasHistoryRag: false, provider: null },
    onSubmit: async (values) => {
      const rebuildPossible = values.hasHistoryRag && (!data?.hasHistoryRag || values.provider !== data.provider);
      if (rebuildPossible && !window.confirm(`This change will rebuild the loop's history index and may take several minutes. Continue?`)) return;

      setFeedback({});
      try {
        await updateLoopMemoryConfig(loopId, values);
        await reload();
        setFeedback({ saved: true });
      } catch (submitError) {
        setFeedback({ error: submitError instanceof Error ? submitError.message : String(submitError) });
      }
    },
  });

  useEffect(() => {
    if (data) formik.resetForm({ values: { hasHistoryRag: data.hasHistoryRag, provider: data.provider } });
  }, [data]);

  if (isPending) return <p>Loading loop history memory...</p>;
  if (isError)
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load loop history memory">
        {error instanceof Error ? error.message : String(error)}
      </Notification>
    );

  const rebuildPossible = formik.values.hasHistoryRag && (!data?.hasHistoryRag || formik.values.provider !== data.provider);

  return (
    <section aria-labelledby="loop-history-memory-heading">
      <h3 className="p-heading--5" id="loop-history-memory-heading">
        History memory
      </h3>
      <form onSubmit={formik.handleSubmit}>
        <div className="p-checkbox">
          <input checked={formik.values.hasHistoryRag} className="p-checkbox__input" disabled={!canEdit || formik.isSubmitting} id="has-history-rag" name="hasHistoryRag" onChange={formik.handleChange} type="checkbox" />
          <label className="p-checkbox__label" htmlFor="has-history-rag">
            Create a searchable RAG index from this loop's history
          </label>
        </div>
        <label className="p-form__label" htmlFor="history-memory-provider">
          Embedding provider
        </label>
        <select
          className="p-form-validation__input"
          disabled={!canEdit || !formik.values.hasHistoryRag || formik.isSubmitting}
          id="history-memory-provider"
          name="provider"
          onChange={(event) => void formik.setFieldValue(`provider`, event.target.value || null)}
          required={formik.values.hasHistoryRag}
          value={formik.values.provider ?? ``}
        >
          <option value="">Select an embedding provider</option>
          {embedders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName} ({provider.embedder?.model})
            </option>
          ))}
        </select>
        {rebuildPossible ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Indexing may take some time">
            Indexing the whole loop might take some time. Wait for a couple of minutes before relying on it heavily.
          </Notification>
        ) : null}
        {data?.hasHistoryRag && data.status === `indexing` ? (
          <Notification severity={NotificationSeverity.INFORMATION} title="History indexing in progress">
            The loop's existing history is being indexed.
          </Notification>
        ) : null}
        {data?.hasHistoryRag && data.status === `failed` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="History indexing failed">
            {data.failureMessage ?? `The background indexing job failed.`}
          </Notification>
        ) : null}
        {data?.hasHistoryRag && data.status === `ready` ? (
          <Notification severity={NotificationSeverity.POSITIVE} title="History memory ready">
            The loop's indexed history is ready for lookup.
          </Notification>
        ) : null}
        {feedback.error ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to save history memory">
            {feedback.error}
          </Notification>
        ) : null}
        {feedback.saved ? (
          <Notification severity={NotificationSeverity.INFORMATION} title="History memory updated">
            The loop history memory settings were saved.
          </Notification>
        ) : null}
        {canEdit ? (
          <Button appearance="positive" disabled={formik.isSubmitting || !formik.dirty || (formik.values.hasHistoryRag && !formik.values.provider)} type="submit">
            {formik.isSubmitting ? `Saving...` : `Save history memory`}
          </Button>
        ) : (
          <p>Only loop admins can change history memory settings.</p>
        )}
      </form>
    </section>
  );
}
