import { MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { useLoopRunnerSessions, useRunnerById } from "@components/runner/runner.query.js";

type LoopRunnerSessionsProps = {
  loopId: string;
  runnerId: string;
};

export function LoopRunnerSessions({ loopId, runnerId }: LoopRunnerSessionsProps) {
  const { state: runnerState } = useRunnerById(runnerId);
  const { state: sessionsState, reload } = useLoopRunnerSessions(loopId);

  const runnerName = runnerState.status === `success` ? runnerState.runner.displayName : `Runner`;

  const queueItems = sessionsState.status === `success` ? sessionsState.data.queueItems.filter((item) => item.runner === runnerId) : [];

  const githubTasks = sessionsState.status === `success` ? sessionsState.data.githubTasks : [];

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <div className="u-clearfix">
        <div className="u-float-left">
          <h1 className="p-heading--4">Agent sessions — {runnerName}</h1>
        </div>
        <div className="u-float-right">
          <button className="p-button--base" onClick={reload} type="button">
            Refresh
          </button>
        </div>
      </div>
      <hr />

      {sessionsState.status === `loading` ? <p className="p-text--default">Loading sessions...</p> : null}
      {sessionsState.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load sessions">
          {sessionsState.message}
        </Notification>
      ) : null}
      {sessionsState.status === `success` && sessionsState.data.githubError ? (
        <Notification severity={NotificationSeverity.CAUTION} title="GitHub API error">
          {sessionsState.data.githubError}
        </Notification>
      ) : null}
      {sessionsState.status === `success` && queueItems.length === 0 ? <p className="p-text--default">No agent sessions for this runner in this loop yet.</p> : null}
      {sessionsState.status === `success` && queueItems.length > 0 ? (
        <MainTable
          className="u-table-layout--auto"
          headers={[{ content: `Repository` }, { content: `Queue status` }, { content: `GitHub state` }, { content: `PR / Branch` }, { content: `Created` }]}
          rows={queueItems.map((item) => {
            const githubTask = githubTasks.find((t) => t.id === item.externalTaskId);
            const artifact = githubTask?.artifacts?.find((a) => a.type === `pull`);
            const prLink =
              artifact && `id` in artifact.data ? (
                <a key="pr" href={`https://github.com/${item.repository}/pull/${artifact.data.id}`} rel="noopener noreferrer" target="_blank">
                  PR #{artifact.data.id}
                </a>
              ) : githubTask?.html_url ? (
                <a key="gh" href={String(githubTask.html_url)} rel="noopener noreferrer" target="_blank">
                  View on GitHub
                </a>
              ) : (
                (item.externalTaskId ?? `-`)
              );

            return {
              key: item.id,
              columns: [
                { content: item.repository },
                { content: item.status },
                { content: githubTask ? githubTask.state : item.externalTaskId ? `fetching…` : `-` },
                { content: prLink },
                { content: new Date(item.createdAt).toLocaleString() },
              ],
            };
          })}
        />
      ) : null}
    </section>
  );
}
