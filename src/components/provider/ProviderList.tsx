import { Button, Icon, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProviderEditor } from "./ProviderEditor.js";
import { deleteProvider } from "./provider.client.js";
import { useProviderList } from "./provider.query.js";
import type { Provider } from "./provider.schema.js";

type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

const lifecycleLabel: Record<Provider["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type ProviderListProps = {
  editor?: `create` | `edit`;
  providerId?: string;
};

export function ProviderList({ editor, providerId }: ProviderListProps) {
  const navigate = useNavigate();
  const { state, reload } = useProviderList();
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: `/provider/list/create` });
    setFeedback(null);
  };

  const openEditDrawer = (provider: Provider) => {
    void navigate({ to: `/provider/list/edit/$providerEditorId`, params: { providerEditorId: provider.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/provider/list` });
  };

  const providers = state.status === `success` ? state.providers : [];
  const selectedProvider = state.status === `success` && providerId ? state.providers.find((provider) => provider.id === providerId) : undefined;

  const handleDelete = async (provider: Provider) => {
    setBusyProviderId(provider.id);
    setFeedback(null);

    try {
      await deleteProvider(provider.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Provider deleted`,
        message: `${provider.displayName} has been deleted.`,
      });

      if (editor === `edit` && providerId === provider.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete provider`,
        message,
      });
    } finally {
      setBusyProviderId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      {state.status === `loading` ? <p className="p-text--default">Loading providers...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load providers">
          {state.message}
        </Notification>
      ) : null}
      <div>
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create provider
              </Button>
            </div>
          </div>
        </div>
        <MainTable
          className="u-table-layout--auto"
          emptyStateMsg="No providers yet."
          headers={[{ content: `Display name` }, { content: `Type` }, { content: `Capabilities` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions`, className: `u-align--right` }]}
          rows={providers.map((provider: Provider) => ({
            key: provider.id,
            columns: [
              {
                content: (
                  <Link params={{ providerId: provider.id }} to={`/provider/$providerId`}>
                    {provider.displayName}
                  </Link>
                ),
              },
              { content: provider.providerType },
              { content: [provider.chat ? `Chat` : null, provider.embedder ? `Embedder` : null].filter(Boolean).join(`, `) },
              { content: lifecycleLabel[provider.lifecycleStatus] ?? provider.lifecycleStatus },
              { content: formatTimestamp(provider.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" aria-label={`Edit ${provider.displayName}`} onClick={() => openEditDrawer(provider)} title={`Edit ${provider.displayName}`} type="button">
                      <Icon aria-hidden="true" name="copy" />
                    </Button>
                    <Button appearance="base" aria-label={`Delete ${provider.displayName}`} disabled={busyProviderId === provider.id} onClick={() => handleDelete(provider)} title={`Delete ${provider.displayName}`} type="button">
                      <Icon aria-hidden="true" className="text-negative" name="delete" />
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit provider` : `Create provider`}>
        {editor === `edit` && !selectedProvider ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Provider not found">
            The selected provider no longer exists.
          </Notification>
        ) : (
          <ProviderEditor
            isDeleting={Boolean(editor === `edit` && selectedProvider && busyProviderId === selectedProvider.id)}
            onDelete={editor === `edit` && selectedProvider ? handleDelete : undefined}
            onSuccess={(title, message) => {
              setFeedback({ severity: NotificationSeverity.INFORMATION, title, message });
              closeDrawer();
              reload();
            }}
            provider={editor === `edit` ? selectedProvider : undefined}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
