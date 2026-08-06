import { Button, Icon, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { useFeedbackToast } from "@components/base/toast.js";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RepositoryEditor } from "./RepositoryEditor.js";
import { deleteRepository } from "./repository.client.js";
import { useRepositoryList } from "./repository.query.js";
import type { Repository } from "./repository.schema.js";

type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

const lifecycleLabel: Record<Repository["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

type RepositoryListProps = {
  editor?: `create` | `edit`;
  repositoryId?: string;
};

export function RepositoryList({ editor, repositoryId }: RepositoryListProps) {
  const navigate = useNavigate();
  const { state, reload } = useRepositoryList();
  const [busyRepositoryId, setBusyRepositoryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useFeedbackToast(feedback, setFeedback);

  const openCreateDrawer = () => {
    void navigate({ to: `/connection/repositories/create` });
    setFeedback(null);
  };

  const openEditDrawer = (repository: Repository) => {
    void navigate({ to: `/connection/repositories/edit/$repositoryId`, params: { repositoryId: repository.id } });
    setFeedback(null);
  };

  const closeDrawer = () => {
    void navigate({ to: `/connection/repositories` });
  };

  const repositories = state.status === `success` ? state.repositories : [];
  const selectedRepository = state.status === `success` && repositoryId ? state.repositories.find((repository) => repository.id === repositoryId) : undefined;

  const handleDelete = async (repository: Repository) => {
    setBusyRepositoryId(repository.id);
    setFeedback(null);

    try {
      await deleteRepository(repository.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Repository deleted`,
        message: `${repository.displayName} has been deleted.`,
      });

      if (editor === `edit` && repositoryId === repository.id) {
        closeDrawer();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete repository`,
        message,
      });
    } finally {
      setBusyRepositoryId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      {state.status === `loading` ? <p className="p-text--default">Loading repositories...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load repositories">
          {state.message}
        </Notification>
      ) : null}
      <div>
        <div className="p-grid">
          <div className="p-grid__row">
            <div className="p-grid__col-12 u-align--right">
              <Button appearance="positive" onClick={openCreateDrawer} type="button">
                Create repository
              </Button>
            </div>
          </div>
        </div>
        <MainTable
          className="u-table-layout--auto"
          emptyStateMsg="No repositories yet."
          headers={[{ content: `Display name` }, { content: `Type` }, { content: `Repository` }, { content: `Status` }, { content: `Updated at` }, { content: `Actions`, className: `u-align--right` }]}
          rows={repositories.map((repository) => ({
            key: repository.id,
            columns: [
              { content: repository.displayName },
              { content: repository.repositoryType },
              { content: `${repository.repositoryOwner}/${repository.repositoryName}` },
              { content: lifecycleLabel[repository.lifecycleStatus] ?? repository.lifecycleStatus },
              { content: formatTimestamp(repository.updatedAt) },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance="base" aria-label={`Edit ${repository.displayName}`} onClick={() => openEditDrawer(repository)} title={`Edit ${repository.displayName}`} type="button">
                      <Icon aria-hidden="true" name="copy" />
                    </Button>
                    <Button
                      appearance="base"
                      aria-label={`Delete ${repository.displayName}`}
                      disabled={busyRepositoryId === repository.id}
                      onClick={() => void handleDelete(repository)}
                      title={`Delete ${repository.displayName}`}
                      type="button"
                    >
                      <Icon aria-hidden="true" className="text-negative" name="delete" />
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      </div>
      <EntityDrawer isOpen={editor === `create` || editor === `edit`} onClose={closeDrawer} title={editor === `edit` ? `Edit repository` : `Create repository`}>
        {editor === `edit` && !selectedRepository ? (
          <Notification severity={NotificationSeverity.CAUTION} title="Repository not found">
            The selected repository no longer exists.
          </Notification>
        ) : (
          <RepositoryEditor
            isDeleting={Boolean(editor === `edit` && selectedRepository && busyRepositoryId === selectedRepository.id)}
            onDelete={editor === `edit` && selectedRepository ? handleDelete : undefined}
            onSuccess={(title, message) => {
              setFeedback({ severity: NotificationSeverity.INFORMATION, title, message });
              closeDrawer();
              reload();
            }}
            repository={editor === `edit` ? selectedRepository : undefined}
          />
        )}
      </EntityDrawer>
    </section>
  );
}
