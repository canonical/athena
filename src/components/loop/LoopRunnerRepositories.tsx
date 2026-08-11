import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { updateLoopRunnerRepositoryList } from "@components/runner/runner.client.js";
import { useLoopRunnerRepositoryList, useRunnerById } from "@components/runner/runner.query.js";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

type LoopRunnerRepositoriesProps = {
  loopId: string;
  runnerId: string;
};

export function LoopRunnerRepositories({ loopId, runnerId }: LoopRunnerRepositoriesProps) {
  const queryClient = useQueryClient();
  const { state: runnerState } = useRunnerById(runnerId);
  const { state: repositoryState, reload } = useLoopRunnerRepositoryList(loopId, runnerId);
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<Set<string>>(new Set());
  const lastSyncedAssignedSignatureRef = useRef<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity]; title: string; message: string } | null>(null);

  const repositories = repositoryState.status === `success` ? repositoryState.repositories : [];
  const runnerName = runnerState.status === `success` ? runnerState.runner.displayName : `Runner`;

  useEffect(() => {
    if (repositoryState.status !== `success`) {
      return;
    }

    const assignedIds = repositoryState.repositories
      .filter((entry) => entry.assigned)
      .map((entry) => entry.repository)
      .sort();
    const assignedSignature = assignedIds.join(`,`);

    if (assignedSignature === lastSyncedAssignedSignatureRef.current) {
      return;
    }

    lastSyncedAssignedSignatureRef.current = assignedSignature;
    setSelectedRepositoryIds(new Set(assignedIds));
  }, [repositoryState.status, repositoryState.status === `success` ? repositoryState.repositories : null]);

  const originalSelection = useMemo(() => {
    if (repositoryState.status !== `success`) {
      return new Set<string>();
    }

    return new Set(repositoryState.repositories.filter((entry) => entry.assigned).map((entry) => entry.repository));
  }, [repositoryState.status, repositoryState.status === `success` ? repositoryState.repositories : null]);

  const hasChanges = useMemo(() => {
    if (repositoryState.status !== `success`) {
      return false;
    }

    if (selectedRepositoryIds.size !== originalSelection.size) {
      return true;
    }

    for (const repositoryId of selectedRepositoryIds) {
      if (!originalSelection.has(repositoryId)) {
        return true;
      }
    }

    return false;
  }, [originalSelection, repositoryState, selectedRepositoryIds]);

  const toggleRepository = (repositoryId: string, checked: boolean) => {
    setSelectedRepositoryIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(repositoryId);
      } else {
        next.delete(repositoryId);
      }

      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      await updateLoopRunnerRepositoryList(loopId, runnerId, [...selectedRepositoryIds]);
      await queryClient.invalidateQueries({ queryKey: [`loopRunnerRepositories`, loopId, runnerId] });
      await queryClient.invalidateQueries({ queryKey: [`loopRunners`, loopId] });
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Assignments saved`,
        message: `Runner repository assignments have been updated.`,
      });
      reload();
    } catch (error) {
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to save assignments`,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <div className="u-clearfix">
        <div className="u-float-left">
          <h1 className="p-heading--4">Runner repositories — {runnerName}</h1>
          <p className="p-text--small">Select which loop repositories this runner can access.</p>
        </div>
        <div className="u-float-right">
          <Link params={{ loopId, loopRunnerId: runnerId }} to="/loop/$loopId/runners/$loopRunnerId">
            Back to sessions
          </Link>
        </div>
      </div>
      <hr />

      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}

      {repositoryState.status === `loading` ? <p className="p-text--default">Loading repositories...</p> : null}
      {repositoryState.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load runner repositories">
          {repositoryState.message}
        </Notification>
      ) : null}
      {repositoryState.status === `success` && repositories.length === 0 ? <p className="p-text--default">No repositories are assigned to this loop yet.</p> : null}

      {repositoryState.status === `success` && repositories.length > 0 ? (
        <>
          <MainTable
            className="u-table-layout--auto"
            headers={[{ content: `Assigned` }, { content: `Display name` }, { content: `Repository` }, { content: `Type` }, { content: `Status` }, { content: `Loop enabled` }]}
            rows={repositories.map((repository) => ({
              key: repository.repository,
              columns: [
                {
                  content: (
                    <input
                      checked={selectedRepositoryIds.has(repository.repository)}
                      disabled={!repository.repositoryEnabled || repository.lifecycleStatus !== `active` || isSaving}
                      id={`loop-runner-repository-${repository.repository}`}
                      onChange={(event) => toggleRepository(repository.repository, event.target.checked)}
                      type="checkbox"
                    />
                  ),
                },
                { content: repository.displayName },
                { content: `${repository.repositoryOwner}/${repository.repositoryName}` },
                { content: repository.repositoryType },
                { content: repository.lifecycleStatus },
                { content: repository.repositoryEnabled ? `Yes` : `No` },
              ],
            }))}
          />

          <div className="u-align--right">
            <Button appearance="base" disabled={isSaving} onClick={reload} type="button">
              Refresh
            </Button>
            <Button appearance="positive" disabled={!hasChanges || isSaving} onClick={() => void handleSave()} type="button">
              {isSaving ? `Saving...` : `Save assignments`}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
