import { Button, Chip, CodeSnippet, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import type { LoopWorkgraphItemListState } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, LoopWorkgraphItem } from "@components/workgraph/workgraph.schema.js";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

type LoopWorkgraphDetailsProps = {
  workgraph: LoopWorkgraph;
  syncInProgress: boolean;
  startingItemId: string | null;
  workOnLabel: string;
  onSyncWorkItems: (workgraph: LoopWorkgraph) => Promise<void>;
  onStartWorkItem: (workgraph: LoopWorkgraph, item: LoopWorkgraphItem) => Promise<void>;
  itemListState: LoopWorkgraphItemListState;
};

type WorkgraphItemNode = {
  id: string;
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
      id: item.id,
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

const extractPayloadLabels = (payload: Record<string, unknown>): string[] => {
  const fields = payload.fields;

  if (!fields || typeof fields !== `object` || Array.isArray(fields)) {
    return [];
  }

  const labels = (fields as Record<string, unknown>).labels;

  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .filter((label): label is string => typeof label === `string`)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
};

const hasWorkOnLabel = (node: WorkgraphItemNode, workOnLabel: string): boolean => {
  const normalizedExpected = workOnLabel.trim().toLowerCase();

  if (normalizedExpected.length === 0) {
    return false;
  }

  return extractPayloadLabels(node.payload).some((label) => label.toLowerCase() === normalizedExpected);
};

const renderNode = (node: WorkgraphItemNode, onSelectItem: (itemKey: string) => void, onStartItem: (id: string) => void, startingItemId: string | null, syncInProgress: boolean, workOnLabel: string): ReactElement => {
  const title = `${node.itemType}: ${node.itemKey} ${node.title}`;
  const labels = extractPayloadLabels(node.payload);
  const alreadyReady = hasWorkOnLabel(node, workOnLabel);
  const isStarting = startingItemId === node.id;
  const startDisabled = syncInProgress || isStarting || alreadyReady;
  const startLabel = alreadyReady ? `Ready` : isStarting ? `Starting...` : `Start Athena`;
  const statusAppearance = !node.status ? `information` : /done|closed|resolved/i.test(node.status) ? `positive` : /progress|doing|wip/i.test(node.status) ? `caution` : /block|failed|error/i.test(node.status) ? `negative` : `information`;

  return (
    <li key={node.itemKey}>
      <div style={{ alignItems: `center`, display: `flex`, gap: `0.75rem`, justifyContent: `space-between`, width: `100%` }}>
        <div style={{ alignItems: `center`, display: `flex`, flex: 1, flexWrap: `nowrap`, gap: `0.375rem`, minWidth: 0, overflow: `hidden` }}>
          <Button appearance="link" onClick={() => onSelectItem(node.itemKey)} style={{ flex: 1, minWidth: 0, overflow: `hidden`, textAlign: `left` }} type="button">
            <span style={{ display: `inline-block`, maxWidth: `100%`, overflow: `hidden`, textOverflow: `ellipsis`, verticalAlign: `middle`, whiteSpace: `nowrap` }}>{title}</span>
          </Button>
          <Chip appearance={statusAppearance} isDense={true} isInline={true} isReadOnly={true} lead="Status" value={node.status ?? `Unknown`} />
          {labels.map((label) => (
            <Chip key={`${node.id}-${label}`} isDense={true} isInline={true} isReadOnly={true} value={label} />
          ))}
        </div>
        <div style={{ alignItems: `center`, alignSelf: `center`, display: `flex`, flexShrink: 0 }}>
          {alreadyReady ? (
            <span className="p-text--small">
              <strong>Ready</strong> ({workOnLabel})
            </span>
          ) : (
            <Button appearance={alreadyReady ? `base` : `positive`} disabled={startDisabled} onClick={() => void onStartItem(node.id)} type="button">
              {startLabel}
            </Button>
          )}
        </div>
      </div>
      {node.children.length > 0 ? <ul>{node.children.map((child) => renderNode(child, onSelectItem, onStartItem, startingItemId, syncInProgress, workOnLabel))}</ul> : null}
    </li>
  );
};

export function LoopWorkgraphDetails({ workgraph, syncInProgress, startingItemId, workOnLabel, onSyncWorkItems, onStartWorkItem, itemListState }: LoopWorkgraphDetailsProps) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [isSyncDrawerOpen, setIsSyncDrawerOpen] = useState(false);
  const hierarchyNodes = buildItemTree(itemListState);
  const byItemId = useMemo(() => {
    if (itemListState.status !== `success`) {
      return new Map<string, LoopWorkgraphItem>();
    }

    return new Map(itemListState.items.map((item) => [item.id, item]));
  }, [itemListState]);
  const flatItems = useMemo<LoopWorkgraphItem[]>(() => (itemListState.status === `success` ? itemListState.items : []), [itemListState]);
  const selectedItem = useMemo(() => flatItems.find((item) => item.itemKey === selectedItemKey), [flatItems, selectedItemKey]);
  const selectedItemPayloadJson = useMemo(() => {
    if (!selectedItem) {
      return ``;
    }

    return JSON.stringify(selectedItem.payload, null, 2);
  }, [selectedItem]);

  const handleStartItem = async (itemId: string) => {
    const item = byItemId.get(itemId);

    if (!item) {
      return;
    }

    await onStartWorkItem(workgraph, item);
  };

  return (
    <>
      <div>
        <div className="u-clearfix">
          <div className="u-float-right">
            <Button appearance="positive" disabled={syncInProgress} onClick={() => setIsSyncDrawerOpen(true)} type="button">
              {syncInProgress ? `Synchronizing...` : `Sync work items`}
            </Button>
          </div>
        </div>
        <hr />
        {syncInProgress ? <p className="p-text--small">Synchronizing...</p> : null}

        {itemListState.status === `loading` ? <p className="p-text--small">Loading synced items...</p> : null}
        {itemListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load synced items">
            {itemListState.message}
          </Notification>
        ) : null}
        {itemListState.status === `success` && hierarchyNodes.length === 0 ? <p className="p-text--small">No synced items yet.</p> : null}
        {itemListState.status === `success` && hierarchyNodes.length > 0 ? <ul>{hierarchyNodes.map((node) => renderNode(node, setSelectedItemKey, handleStartItem, startingItemId, syncInProgress, workOnLabel))}</ul> : null}
      </div>

      <EntityDrawer isOpen={isSyncDrawerOpen} onClose={() => setIsSyncDrawerOpen(false)} title="Sync work items">
        <p className="p-text--default">Schedule synchronization for this workgraph to fetch the latest items.</p>
        <div className="u-align--right">
          <Button appearance="base" onClick={() => setIsSyncDrawerOpen(false)} type="button">
            Cancel
          </Button>
          <Button
            appearance="positive"
            disabled={syncInProgress}
            onClick={() => {
              void onSyncWorkItems(workgraph);
              setIsSyncDrawerOpen(false);
            }}
            type="button"
          >
            {syncInProgress ? `Synchronizing...` : `Sync work items`}
          </Button>
        </div>
      </EntityDrawer>

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
              <strong>Jira URL:</strong>
              {` `}
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
