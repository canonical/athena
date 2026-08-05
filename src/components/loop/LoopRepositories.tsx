import { Button, MainTable, Notification, NotificationSeverity, Select } from "@canonical/react-components";
import { assignRepositoryToLoop, removeRepositoryFromLoop } from "@components/repository/repository.client.js";
import { useLoopRepositoryList, useRepositoryList } from "@components/repository/repository.query.js";
import type { LoopRepository, Repository } from "@components/repository/repository.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { useState } from "react";
import type { LoopRepositoriesProps } from "./loop.schema.js";

const lifecycleLabel: Record<Repository["lifecycleStatus"], string> = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
};

const formatTimestamp = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : `-`);

export function LoopRepositories({ loopId, onFeedback }: LoopRepositoriesProps) {
  const queryClient = useQueryClient();
  const { state: repositoryListState } = useRepositoryList();
  const { state: assignedRepositoryState, reload: reloadAssignedRepositories } = useLoopRepositoryList(loopId);
  const [busyRepositoryId, setBusyRepositoryId] = useState<string | null>(null);

  const availableRepositories = repositoryListState.status === `success` ? repositoryListState.repositories : [];
  const assignedRepositories = assignedRepositoryState.status === `success` ? assignedRepositoryState.repositories : [];

  const assignedRepositoryIds = new Set(assignedRepositories.map((repository) => repository.repository));
  const unassignedRepositories = availableRepositories.filter((repository) => !assignedRepositoryIds.has(repository.id));

  const assignFormik = useFormik<{ selectedRepositoryId: string }>({
    initialValues: { selectedRepositoryId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedRepositoryId) {
        return;
      }

      onFeedback(null);

      try {
        await assignRepositoryToLoop(loopId, values.selectedRepositoryId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Repository assigned`,
          message: `Repository has been assigned to this loop.`,
        });
        helpers.resetForm();
        await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
        reloadAssignedRepositories();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign repository`,
          message,
        });
      }
    },
  });

  const handleRemoveAssignment = async (repository: LoopRepository) => {
    setBusyRepositoryId(repository.repository);
    onFeedback(null);

    try {
      await removeRepositoryFromLoop(loopId, repository.repository);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Repository removed`,
        message: `${repository.displayName} has been removed from this loop.`,
      });
      await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
      reloadAssignedRepositories();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove repository`,
        message,
      });
    } finally {
      setBusyRepositoryId(null);
    }
  };

  return (
    <>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assign an existing repository</h2>
        {repositoryListState.status === `loading` ? <p className="p-text--default">Loading available repositories...</p> : null}
        {repositoryListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load available repositories">
            {repositoryListState.message}
          </Notification>
        ) : null}
        {repositoryListState.status === `success` && availableRepositories.length === 0 ? <p className="p-text--default">No repositories are available yet. Create a repository connection first, then assign it to this loop.</p> : null}
        {repositoryListState.status === `success` && availableRepositories.length > 0 && unassignedRepositories.length === 0 ? <p className="p-text--default">All available repositories are already assigned to this loop.</p> : null}
        <form onSubmit={assignFormik.handleSubmit}>
          <Select
            id="assign-repository-select"
            label="Repository"
            name="selectedRepositoryId"
            onChange={assignFormik.handleChange}
            options={[{ value: ``, label: `- Select a repository -` }, ...unassignedRepositories.map((repository) => ({ value: repository.id, label: repository.displayName }))]}
            value={assignFormik.values.selectedRepositoryId}
          />
          <div className="u-align--right">
            <Button appearance="base" disabled={!assignFormik.values.selectedRepositoryId || assignFormik.isSubmitting} type="submit">
              {assignFormik.isSubmitting ? `Assigning...` : `Assign repository`}
            </Button>
          </div>
        </form>
      </div>

      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Assigned repositories</h2>
        {assignedRepositoryState.status === `loading` ? <p className="p-text--default">Loading repositories...</p> : null}
        {assignedRepositoryState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load assigned repositories">
            {assignedRepositoryState.message}
          </Notification>
        ) : null}
        {assignedRepositoryState.status === `success` && assignedRepositories.length === 0 ? <p className="p-text--default">No repositories assigned to this loop yet.</p> : null}
        {assignedRepositoryState.status === `success` && assignedRepositories.length > 0 ? (
          <MainTable
            headers={[{ content: `Display name` }, { content: `Type` }, { content: `Repository` }, { content: `Status` }, { content: `Enabled` }, { content: `Updated at` }, { content: `Actions` }]}
            rows={assignedRepositories.map((repository) => ({
              key: repository.repository,
              columns: [
                { content: repository.displayName },
                { content: repository.repositoryType },
                { content: `${repository.repositoryOwner}/${repository.repositoryName}` },
                { content: lifecycleLabel[repository.lifecycleStatus] ?? repository.lifecycleStatus },
                { content: repository.enabled ? `Yes` : `No` },
                { content: formatTimestamp(repository.updatedAt) },
                {
                  content: (
                    <div className="u-align--right">
                      <Button appearance="negative" disabled={busyRepositoryId === repository.repository} onClick={() => handleRemoveAssignment(repository)} type="button">
                        {busyRepositoryId === repository.repository ? `Removing ${repository.displayName}...` : `Remove ${repository.displayName}`}
                      </Button>
                    </div>
                  ),
                },
              ],
            }))}
          />
        ) : null}
      </div>
    </>
  );
}
