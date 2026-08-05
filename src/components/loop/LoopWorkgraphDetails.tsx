import { Button, CodeSnippet, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import type { LoopWorkgraphItemListState } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, LoopWorkgraphItem } from "@components/workgraph/workgraph.schema.js";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

type LoopWorkgraphDetailsProps = {
  workgraph: LoopWorkgraph;
  syncingWorkgraphId: string | null;
  onSyncWorkItems: (workgraph: LoopWorkgraph) => Promise<void>;
  itemListState: LoopWorkgraphItemListState;
};

type WorkgraphItemNode = {
  itemId: string;
  itemKey: string;
  parentKey: string | null;
  title: string;
  itemType: string;
  status: string | null;
  webUrl: string | null;
  payload: Record<string, unknown>;
  children: WorkgraphItemNode[];
};

const buildItemTree = (state: LoopWorkgraphItemListState): WorkgraphItemNode[] => {
  if (state.status !== `success`) {
    return [];
  }

  const byKey = new Map<string, WorkgraphItemNode>();
  const childBuckets = new Map<string, WorkgraphItemNode[]>();

  for (const item of state.items) {
    byKey.set(item.itemKey, {
      itemId: item.itemId,
      itemKey: item.itemKey,
      parentKey: item.parentKey,
      title: item.title,
      itemType: item.itemType,
      status: item.status,
      webUrl: item.webUrl,
      payload: item.payload,
      children: [],
    });
  }

  const roots: WorkgraphItemNode[] = [];

  for (const item of state.items) {
    const node = byKey.get(item.itemKey);

    if (!node) {
      continue;
    }

    if (item.parentKey && byKey.has(item.parentKey)) {
      const existingChildren = childBuckets.get(item.parentKey) ?? [];
      existingChildren.push(node);
      childBuckets.set(item.parentKey, existingChildren);
      continue;
    }

    roots.push(node);
  }

  for (const [parentKey, children] of childBuckets.entries()) {
    const parent = byKey.get(parentKey);

    if (!parent) {
      continue;
    }

    parent.children = children.sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  }

  return roots.sort((a, b) => a.itemKey.localeCompare(b.itemKey));
};

const renderNode = (node: WorkgraphItemNode, onSelectItem: (itemKey: string) => void): ReactElement => {
  const metadata = node.status ? `${node.itemType} - ${node.status}` : node.itemType;

  return (
    <li key={node.itemKey}>
      <Button appearance="link" onClick={() => onSelectItem(node.itemKey)} type="button">
        <>
          <strong>{node.itemKey}</strong> {node.title} <span className="p-text--small">({metadata})</span>
        </>
      </Button>
      {node.children.length > 0 ? <ul>{node.children.map((child) => renderNode(child, onSelectItem))}</ul> : null}
    </li>
  );
};

export function LoopWorkgraphDetails({ workgraph, syncingWorkgraphId, onSyncWorkItems, itemListState }: LoopWorkgraphDetailsProps) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const hierarchyNodes = buildItemTree(itemListState);
  const flatItems = useMemo<LoopWorkgraphItem[]>(() => (itemListState.status === `success` ? itemListState.items : []), [itemListState]);
  const selectedItem = useMemo(() => flatItems.find((item) => item.itemKey === selectedItemKey), [flatItems, selectedItemKey]);
  const selectedItemPayloadJson = useMemo(() => {
    if (!selectedItem) {
      return ``;
    }

    return JSON.stringify(selectedItem.payload, null, 2);
  }, [selectedItem]);

  return (
    <>
      <div className="p-card p-strip is-shallow">
        <div className="u-align--right">
          <Button appearance="positive" disabled={syncingWorkgraphId === workgraph.workgraph} onClick={() => void onSyncWorkItems(workgraph)} type="button">
            {syncingWorkgraphId === workgraph.workgraph ? `Syncing...` : `Sync work items`}
          </Button>
        </div>

        {itemListState.status === `loading` ? <p className="p-text--small">Loading synced items...</p> : null}
        {itemListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load synced items">
            {itemListState.message}
          </Notification>
        ) : null}
        {itemListState.status === `success` && hierarchyNodes.length === 0 ? <p className="p-text--small">No synced items yet.</p> : null}
        {itemListState.status === `success` && hierarchyNodes.length > 0 ? <ul>{hierarchyNodes.map((node) => renderNode(node, setSelectedItemKey))}</ul> : null}
      </div>

      <EntityDrawer
        isOpen={Boolean(selectedItem)}
        onClose={() => {
          setSelectedItemKey(null);
        }}
        size="large"
        title={selectedItem ? `${selectedItem.itemKey} details` : `Work item details`}
      >
        {selectedItem ? (
          <>
            <p className="p-text--default">
              <strong>Title:</strong> {selectedItem.title}
            </p>
            <p className="p-text--default">
              <strong>Type:</strong> {selectedItem.itemType}
            </p>
            <p className="p-text--default">
              <strong>Status:</strong> {selectedItem.status ?? `-`}
            </p>
            <p className="p-text--default">
              <strong>Parent:</strong> {selectedItem.parentKey ?? `-`}
            </p>
            <p className="p-text--default">
              <strong>Jira URL:</strong>{` `}
              {selectedItem.webUrl ? (
                <a href={selectedItem.webUrl} rel="noreferrer" target="_blank">
                  {selectedItem.webUrl}
                </a>
              ) : (
                `-`
              )}
            </p>
            <h3 className="p-heading--5">Payload JSON</h3>
            <CodeSnippet
              blocks={[
                {
                  code: selectedItemPayloadJson,
                  wrapLines: true,
                },
              ]}
            />
          </>
        ) : null}
      </EntityDrawer>
    </>
  );
}
