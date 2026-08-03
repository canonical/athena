import { Link, useNavigate } from "@tanstack/react-router";
import { WorkgraphList } from "@components/workgraph/WorkgraphList.js";

type ConnectionTab = `workgraphs` | `repositories`;

type ConnectionsProps = {
  tab: ConnectionTab;
  create?: true;
  edit?: string;
};

export function Connections({ tab, create, edit }: ConnectionsProps) {
  const navigate = useNavigate();

  const setTab = (nextTab: ConnectionTab) => {
    void navigate({
      to: `/connection`,
      search: {
        tab: nextTab,
        create: undefined,
        edit: undefined,
      },
    });
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Connections</h1>
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

      {tab === `workgraphs` ? <WorkgraphList editor={create ? `create` : edit ? `edit` : undefined} listRoute="/connection" workgraphId={edit} /> : null}

      {tab === `repositories` ? (
        <div className="p-card p-strip is-shallow">
          <h2 className="p-heading--4">Repositories</h2>
          <p className="p-text--default">Repository definition and assignment will be implemented in the next phase using the same definition/assignment pattern as workgraphs.</p>
          <p className="p-text--default">
            Continue using loop-level Provider and Runner assignments for execution plumbing while repository connections are introduced.
          </p>
          <p className="p-text--default">
            Existing Workgraph definitions remain available under this Connections view, and detail pages are accessible via <Link to="/workgraph/list">Workgraph list</Link>.
          </p>
        </div>
      ) : null}
    </section>
  );
}
