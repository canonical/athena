import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LazyRepositoryList = lazy(async () => {
  const module = await import("@components/repository/RepositoryList.js");

  return { default: module.RepositoryList };
});

const LazyWorkgraphList = lazy(async () => {
  const module = await import("@components/workgraph/WorkgraphList.js");

  return { default: module.WorkgraphList };
});

type ConnectionTab = `workgraphs` | `repositories`;

type ConnectionsProps = {
  tab: ConnectionTab;
  create?: true;
  edit?: string;
};

export function Connections({ tab, create, edit }: ConnectionsProps) {
  const navigate = useNavigate();

  const setTab = (nextTab: ConnectionTab) => {
    void navigate({ to: nextTab === `repositories` ? `/connection/repositories` : `/connection/workgraphs` });
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <nav aria-label="Connection sections" className="p-tabs">
        <div role="tablist">
          <ul className="p-tabs__list">
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `workgraphs`} className={`p-tabs__link${tab === `workgraphs` ? ` is-active` : ``}`} onClick={() => setTab(`workgraphs`)} role="tab" type="button">
                Workgraphs
              </button>
            </li>
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={tab === `repositories`} className={`p-tabs__link${tab === `repositories` ? ` is-active` : ``}`} onClick={() => setTab(`repositories`)} role="tab" type="button">
                Repositories
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {tab === `workgraphs` ? (
        <Suspense fallback={<p className="p-text--default">Loading workgraphs...</p>}>
          <LazyWorkgraphList editor={create ? `create` : edit ? `edit` : undefined} listRoute="/connection/workgraphs" workgraphId={edit} />
        </Suspense>
      ) : null}

      {tab === `repositories` ? (
        <Suspense fallback={<p className="p-text--default">Loading repositories...</p>}>
          <LazyRepositoryList editor={create ? `create` : edit ? `edit` : undefined} repositoryId={edit} />
        </Suspense>
      ) : null}
    </section>
  );
}
