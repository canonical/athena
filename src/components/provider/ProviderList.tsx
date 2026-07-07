import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useNavigate } from "@tanstack/react-router";
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

  const openCreateDrawer = () => {
    void navigate({ to: `/provider/list`, search: { create: true, edit: undefined } });
    setFeedback(null);
  };

  const openEditDrawer = (provider: Provider) => {
    void navigate({ to: `/provider/list`, search: { create: undefined, edit: provider.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/provider/list`, search: { create: undefined, edit: undefined } });
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
      <h1 className="p-heading--2">Providers</h1>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      {state.status === `loading` ? <p className="p-text--default">Loading providers...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load providers">
          {state.message}
        </Notification>
      ) : null}
      <div className="p-card p-strip is-shallow">
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
          emptyStateMsg="No providers yet."
          headers={[{ content: `Display name` }, { content: `Type` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions` }]}
          rows={providers.map((provider: Provider) => ({
            key: provider.id,
            columns: [
              { content: provider.displayName },
              { content: provider.providerType },
              { content: lifecycleLabel[provider.lifecycleStatus] ?? provider.lifecycleStatus },
              { content: formatTimestamp(provider.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" onClick={() => openEditDrawer(provider)} type="button">
                      {`Edit ${provider.displayName}`}
                    </Button>
                    <Button appearance="negative" disabled={busyProviderId === provider.id} onClick={() => handleDelete(provider)} type="button">
                      {busyProviderId === provider.id ? `Deleting ${provider.displayName}...` : `Delete ${provider.displayName}`}
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
