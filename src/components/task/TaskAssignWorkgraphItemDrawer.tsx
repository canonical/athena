import { Button, Input } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { searchLoopWorkgraphItems } from "@components/workgraph/workgraph.client.js";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTaskAssignedWorkgraphItem } from "./task.query.js";
import type { Task } from "./task.schema.js";

type TaskAssignWorkgraphItemDrawerProps = {
  loopId: string;
  task: Task;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (itemId: string) => Promise<void>;
};

export function TaskAssignWorkgraphItemDrawer({ loopId, task, isOpen, isSaving, onClose, onSave }: TaskAssignWorkgraphItemDrawerProps) {
  const [search, setSearch] = useState(``);
  const [debouncedSearch, setDebouncedSearch] = useState(``);
  const { item: assignedItem, isLoading: assignedLoading } = useTaskAssignedWorkgraphItem(loopId, task.id, Boolean(task.workgraphItem));

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: [`loopWorkgraphItemSearch`, loopId, debouncedSearch],
    queryFn: () => searchLoopWorkgraphItems(loopId, debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const showResults = debouncedSearch.length >= 2;

  return (
    <EntityDrawer isOpen={isOpen} onClose={onClose} title="Assign to workgraph item">
      <div style={{ display: `flex`, flexDirection: `column`, gap: `1rem` }}>
        {task.workgraphItem && (
          <div>
            <p className="p-form__label">Currently assigned</p>
            {assignedLoading ? (
              <p className="p-text--small">Loading…</p>
            ) : assignedItem ? (
              <p className="p-text--small" style={{ margin: 0 }}>
                {assignedItem.title ?? `(no title)`}
                {assignedItem.itemKey && <span style={{ opacity: 0.6 }}> · {assignedItem.itemKey}</span>}
                {` · `}
                <span style={{ opacity: 0.6 }}>{assignedItem.itemType}</span>
              </p>
            ) : (
              <p className="p-text--small" style={{ opacity: 0.6, margin: 0 }}>
                Item not found.
              </p>
            )}
          </div>
        )}

        <Input id="assign-search" label="Search workgraph items" onChange={(e) => setSearch(e.target.value)} placeholder="Type title, key, or type…" type="text" value={search} />

        {showResults && (
          <div style={{ display: `flex`, flexDirection: `column`, gap: `0.5rem` }}>
            {isFetching ? (
              <p className="p-text--small" style={{ opacity: 0.6, margin: 0 }}>
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="p-text--small" style={{ opacity: 0.6, margin: 0 }}>
                No items found.
              </p>
            ) : (
              results.map((item) => (
                <div key={item.id} style={{ alignItems: `center`, display: `flex`, gap: `0.5rem`, justifyContent: `space-between` }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="p-text--small" style={{ margin: 0, overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap` }}>
                      {item.title}
                    </p>
                    <p className="p-text--small" style={{ margin: 0, opacity: 0.6 }}>
                      {item.itemKey} · {item.itemType}
                    </p>
                  </div>
                  <Button appearance="positive" dense disabled={isSaving} onClick={() => void onSave(item.id)} style={{ flexShrink: 0 }} type="button">
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <div style={{ display: `flex`, gap: `0.5rem`, justifyContent: `flex-end` }}>
          <Button appearance="base" onClick={onClose} type="button">
            Cancel
          </Button>
        </div>
      </div>
    </EntityDrawer>
  );
}
