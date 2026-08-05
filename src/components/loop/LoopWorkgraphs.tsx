import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { assignWorkgraphToLoop, removeWorkgraphFromLoop, startLoopWorkgraphItem, syncLoopWorkgraphItems, updateLoopWorkgraphByAdmin } from "@components/workgraph/workgraph.client.js";
import { useLoopWorkgraphIssueTypes, useLoopWorkgraphItems, useLoopWorkgraphList, useWorkgraphList } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph, LoopWorkgraphItem } from "@components/workgraph/workgraph.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { LoopWorkgraphsProps } from "./loop.schema.js";
import type { WorkgraphIssueType } from "@components/workgraph/workgraph.schema.js";

const LazyLoopWorkgraphDefinitions = lazy(async () => {
  const module = await import("./LoopWorkgraphDefinitions.js");

  return { default: module.LoopWorkgraphDefinitions };
});

const LazyLoopWorkgraphDetails = lazy(async () => {
  const module = await import("./LoopWorkgraphDetails.js");

  return { default: module.LoopWorkgraphDetails };
});

const LazyLoopWorkgraphConfigJql = lazy(async () => {
  const module = await import("./LoopWorkgraphConfigJql.js");

  return { default: module.LoopWorkgraphConfigJql };
});

const LazyLoopWorkgraphConfigLabels = lazy(async () => {
  const module = await import("./LoopWorkgraphConfigLabels.js");

  return { default: module.LoopWorkgraphConfigLabels };
});

const LazyLoopWorkgraphConfigTypePlaybooks = lazy(async () => {
  const module = await import("./LoopWorkgraphConfigTypePlaybooks.js");

  return { default: module.LoopWorkgraphConfigTypePlaybooks };
});

const LazyLoopWorkgraphConfigWebhookDefinitions = lazy(async () => {
  const module = await import("@components/webhook/WebhookDefinitions.js");

  return { default: module.WebhookDefinitions };
});

const formatTimestamp = (value: Date | string | null) => (value ? new Date(value).toLocaleString() : `-`);

const statusLabels: Record<`never` | `synchronizing` | `synchronized` | `failed`, string> = {
  never: `Never synced`,
  synchronizing: `Synchronizing`,
  synchronized: `Last sync succeeded`,
  failed: `Last sync failed`,
};

const jqlPreview = (jql: string) => {
  const normalized = jql.trim();

  if (normalized.length === 0) {
    return `-`;
  }

  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
};

const parseTypeInstructions = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((accumulator, [key, instruction]) => {
    if (typeof instruction === `string`) {
      accumulator[key] = instruction;
    }

    return accumulator;
  }, {});
};

const parseAssignmentJql = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return ``;
  }

  const assignmentConfig = value as Record<string, unknown>;
  return typeof assignmentConfig.jql === `string` ? assignmentConfig.jql : ``;
};

const normalizeTypeInstructionsById = (input: Record<string, string>, issueTypes: WorkgraphIssueType[]): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const issueType of issueTypes) {
    const byId = input[issueType.id];

    if (typeof byId === `string` && byId.trim().length > 0) {
      normalized[issueType.id] = byId;
      continue;
    }

    const byName = input[issueType.name];

    if (typeof byName === `string` && byName.trim().length > 0) {
      normalized[issueType.id] = byName;
    }
  }

  return normalized;
};

export function LoopWorkgraphs({ loopId, onFeedback, workgraphViewWorkgraphId, workgraphConfigTab }: LoopWorkgraphsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state: workgraphListState } = useWorkgraphList();
  const { state: assignedWorkgraphState, reload: reloadAssignedWorkgraphs } = useLoopWorkgraphList(loopId, { pollWhenSynchronizing: true, pollIntervalMs: 3000 });
  const [busyWorkgraphId, setBusyWorkgraphId] = useState<string | null>(null);
  const [startingItemId, setStartingItemId] = useState<string | null>(null);
  const hydratedWorkgraphIdRef = useRef<string | null>(null);

  const availableWorkgraphs = workgraphListState.status === `success` ? workgraphListState.workgraphs : [];
  const assignedWorkgraphs = assignedWorkgraphState.status === `success` ? assignedWorkgraphState.workgraphs : [];

  const assignedWorkgraphIds = new Set(assignedWorkgraphs.map((workgraph) => workgraph.workgraph));
  const unassignedWorkgraphs = availableWorkgraphs.filter((workgraph) => !assignedWorkgraphIds.has(workgraph.id));
  const selectedWorkgraphView = workgraphViewWorkgraphId ? assignedWorkgraphs.find((workgraph) => workgraph.workgraph === workgraphViewWorkgraphId) : undefined;
  const selectedWorkgraphId = selectedWorkgraphView?.workgraph ?? null;
  const selectedWorkgraphSyncInProgress = selectedWorkgraphView?.lastSyncStatus === `synchronizing`;
  const { state: workgraphItemListState, reload: reloadWorkgraphItems } = useLoopWorkgraphItems(loopId, selectedWorkgraphId, {
    pollIntervalMs: selectedWorkgraphSyncInProgress ? 3000 : undefined,
  });
  const { state: issueTypeState } = useLoopWorkgraphIssueTypes(loopId, selectedWorkgraphId);
  const activeSubtab: `definitions` | string = selectedWorkgraphView ? selectedWorkgraphView.workgraph : `definitions`;
  const activeConfigTab = workgraphConfigTab ?? `jql`;

  const applyWorkgraphConfigValues = (workgraph: LoopWorkgraph) => {
    const assignmentConfig = workgraph.assignmentConfig as Record<string, unknown>;
    const parsedTypeInstructions = parseTypeInstructions(assignmentConfig?.typeInstructions);
    const typeInstructions = issueTypeState.status === `success` ? normalizeTypeInstructionsById(parsedTypeInstructions, issueTypeState.issueTypes) : parsedTypeInstructions;

    updateFormik.setValues({
      jql: parseAssignmentJql(assignmentConfig),
      workOnLabel: readWorkOnLabelFromAssignmentConfig(assignmentConfig),
      workInProgressLabel: readWorkInProgressLabelFromAssignmentConfig(assignmentConfig),
      workDoneLabel: readWorkDoneLabelFromAssignmentConfig(assignmentConfig),
      typeInstructions,
    });
  };

  const openDefinitionsSubtab = () => {
    void navigate({
      to: `/loop/$loopId`,
      params: { loopId },
      search: (previous) => ({ ...previous, tab: `workgraphs`, workgraphView: undefined, workgraphConfigTab: undefined }),
    });
  };

  const openWorkgraphSubtab = (workgraphId: string) => {
    void navigate({
      to: `/loop/$loopId`,
      params: { loopId },
      search: (previous) => ({ ...previous, tab: `workgraphs`, workgraphView: workgraphId, workgraphConfigTab: `jql` }),
    });
  };

  const openWorkgraphConfigTab = (workgraphId: string, tab: `jql` | `labels` | `item-type-playbooks` | `webhook-definitions` | `synced-items`) => {
    void navigate({
      to: `/loop/$loopId`,
      params: { loopId },
      search: (previous) => ({ ...previous, tab: `workgraphs`, workgraphView: workgraphId, workgraphConfigTab: tab }),
    });
  };

  const handleSyncWorkItems = async (workgraph: LoopWorkgraph) => {
    if (workgraph.lastSyncStatus === `synchronizing`) {
      return;
    }

    onFeedback(null);

    try {
      const result = await syncLoopWorkgraphItems(loopId, workgraph.workgraph);
      queryClient.setQueryData<LoopWorkgraph[]>([`loopWorkgraphs`, loopId], (current) => {
        if (!current) {
          return current;
        }

        return current.map((entry) => (entry.workgraph === workgraph.workgraph ? { ...entry, lastSyncStatus: result.state, lastSyncError: null } : entry));
      });
      reloadAssignedWorkgraphs();
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Sync scheduled`,
        message: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Sync failed`,
        message,
      });
    }
  };

  const handleStartWorkItem = async (workgraph: LoopWorkgraph, item: LoopWorkgraphItem) => {
    setStartingItemId(item.id);
    onFeedback(null);

    try {
      const result = await startLoopWorkgraphItem(loopId, workgraph.workgraph, item.id);
      await syncLoopWorkgraphItems(loopId, workgraph.workgraph);
      reloadAssignedWorkgraphs();
      reloadWorkgraphItems();
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Item marked ready`,
        message: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to mark item ready`,
        message,
      });
    } finally {
      setStartingItemId(null);
    }
  };

  const assignFormik = useFormik<{ selectedWorkgraphId: string }>({
    initialValues: { selectedWorkgraphId: `` },
    onSubmit: async (values, helpers) => {
      if (!values.selectedWorkgraphId) {
        return;
      }

      onFeedback(null);

      try {
        await assignWorkgraphToLoop(loopId, values.selectedWorkgraphId);
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Workgraph assigned`,
          message: `Workgraph has been assigned to this loop.`,
        });
        helpers.resetForm();
        await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
        reloadAssignedWorkgraphs();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to assign workgraph`,
          message,
        });
      }
    },
  });

  const updateFormik = useFormik<{ jql: string; workOnLabel: string; workInProgressLabel: string; workDoneLabel: string; typeInstructions: Record<string, string> }>({
    enableReinitialize: true,
    initialValues: {
      jql: ``,
      workOnLabel: readWorkOnLabelFromAssignmentConfig(undefined),
      workInProgressLabel: readWorkInProgressLabelFromAssignmentConfig(undefined),
      workDoneLabel: readWorkDoneLabelFromAssignmentConfig(undefined),
      typeInstructions: {},
    },
    onSubmit: async (values) => {
      if (!selectedWorkgraphId) {
        return;
      }

      onFeedback(null);

      const jql = values.jql.trim();
      const workOnLabel = values.workOnLabel.trim();
      const workInProgressLabel = values.workInProgressLabel.trim();
      const workDoneLabel = values.workDoneLabel.trim();

      if (jql.length === 0) {
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update assignment`,
          message: `JQL is required.`,
        });
        return;
      }

      if (workOnLabel.length === 0 || workInProgressLabel.length === 0 || workDoneLabel.length === 0) {
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update assignment`,
          message: `Work on label, work in progress label, and work done label are required.`,
        });
        return;
      }

      const typeInstructions = Object.entries(values.typeInstructions).reduce<Record<string, string>>((accumulator, [issueTypeId, instruction]) => {
        const normalizedInstruction = instruction.trim();

        if (normalizedInstruction.length > 0) {
          accumulator[issueTypeId] = normalizedInstruction;
        }

        return accumulator;
      }, {});

      try {
        await updateLoopWorkgraphByAdmin(loopId, selectedWorkgraphId, {
          assignmentConfig: {
            jql,
            workOnLabel,
            workInProgressLabel,
            workDoneLabel,
            typeInstructions,
          },
        });
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Workgraph configuration updated`,
          message: `Workgraph configuration has been saved.`,
        });
        reloadAssignedWorkgraphs();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Unable to update assignment`,
          message,
        });
      }
    },
  });

  useEffect(() => {
    if (!selectedWorkgraphView) {
      hydratedWorkgraphIdRef.current = null;
      return;
    }

    const workgraphChanged = hydratedWorkgraphIdRef.current !== selectedWorkgraphView.workgraph;

    // Preserve in-progress edits; only hydrate on selection change or when form is clean.
    if (workgraphChanged || !updateFormik.dirty) {
      applyWorkgraphConfigValues(selectedWorkgraphView);
      hydratedWorkgraphIdRef.current = selectedWorkgraphView.workgraph;
    }
  }, [selectedWorkgraphView, issueTypeState.status, updateFormik.dirty]);

  const handleRemoveAssignment = async (workgraph: LoopWorkgraph) => {
    setBusyWorkgraphId(workgraph.workgraph);
    onFeedback(null);

    try {
      await removeWorkgraphFromLoop(loopId, workgraph.workgraph);
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Workgraph removed`,
        message: `${workgraph.name} has been removed from this loop.`,
      });
      await queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
      reloadAssignedWorkgraphs();
      if (selectedWorkgraphId === workgraph.workgraph) {
        void navigate({
          to: `/loop/$loopId`,
          params: { loopId },
          search: (previous) => ({ ...previous, tab: `workgraphs`, workgraphView: undefined, workgraphConfigTab: undefined }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to remove workgraph`,
        message,
      });
    } finally {
      setBusyWorkgraphId(null);
    }
  };

  return (
    <>
      <nav aria-label="Workgraph views" className="p-tabs">
        <div role="tablist">
          <ul className="p-tabs__list">
            <li className="p-tabs__item" role="presentation">
              <button aria-selected={activeSubtab === `definitions`} className={`p-tabs__link${activeSubtab === `definitions` ? ` is-active` : ``}`} onClick={openDefinitionsSubtab} role="tab" type="button">
                Definitions
              </button>
            </li>
            {assignedWorkgraphs.map((workgraph) => (
              <li className="p-tabs__item" key={workgraph.workgraph} role="presentation">
                <button
                  aria-selected={activeSubtab === workgraph.workgraph}
                  className={`p-tabs__link${activeSubtab === workgraph.workgraph ? ` is-active` : ``}`}
                  onClick={() => openWorkgraphSubtab(workgraph.workgraph)}
                  role="tab"
                  type="button"
                >
                  {workgraph.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {activeSubtab === `definitions` ? (
        <Suspense fallback={<p className="p-text--default">Loading definitions...</p>}>
          <LazyLoopWorkgraphDefinitions
            assignedWorkgraphState={assignedWorkgraphState}
            assignedWorkgraphs={assignedWorkgraphs}
            assignFormik={assignFormik}
            availableWorkgraphs={availableWorkgraphs}
            busyWorkgraphId={busyWorkgraphId}
            formatTimestamp={formatTimestamp}
            jqlPreview={jqlPreview}
            onOpenWorkgraphSubtab={openWorkgraphSubtab}
            onRemoveAssignment={handleRemoveAssignment}
            statusLabels={statusLabels}
            unassignedWorkgraphs={unassignedWorkgraphs}
            workgraphListState={workgraphListState}
          />
        </Suspense>
      ) : null}

      {activeSubtab !== `definitions` && selectedWorkgraphView ? (
        <>
          <nav aria-label="Workgraph configuration tabs" className="p-tabs">
            <div role="tablist">
              <ul className="p-tabs__list">
                <li className="p-tabs__item" role="presentation">
                  <button
                    aria-selected={activeConfigTab === `jql`}
                    className={`p-tabs__link${activeConfigTab === `jql` ? ` is-active` : ``}`}
                    onClick={() => openWorkgraphConfigTab(selectedWorkgraphView.workgraph, `jql`)}
                    role="tab"
                    type="button"
                  >
                    JQL
                  </button>
                </li>
                <li className="p-tabs__item" role="presentation">
                  <button
                    aria-selected={activeConfigTab === `labels`}
                    className={`p-tabs__link${activeConfigTab === `labels` ? ` is-active` : ``}`}
                    onClick={() => openWorkgraphConfigTab(selectedWorkgraphView.workgraph, `labels`)}
                    role="tab"
                    type="button"
                  >
                    Labels
                  </button>
                </li>
                <li className="p-tabs__item" role="presentation">
                  <button
                    aria-selected={activeConfigTab === `item-type-playbooks`}
                    className={`p-tabs__link${activeConfigTab === `item-type-playbooks` ? ` is-active` : ``}`}
                    onClick={() => openWorkgraphConfigTab(selectedWorkgraphView.workgraph, `item-type-playbooks`)}
                    role="tab"
                    type="button"
                  >
                    Item Type Playbooks
                  </button>
                </li>
                <li className="p-tabs__item" role="presentation">
                  <button
                    aria-selected={activeConfigTab === `webhook-definitions`}
                    className={`p-tabs__link${activeConfigTab === `webhook-definitions` ? ` is-active` : ``}`}
                    onClick={() => openWorkgraphConfigTab(selectedWorkgraphView.workgraph, `webhook-definitions`)}
                    role="tab"
                    type="button"
                  >
                    Webhook Definitions
                  </button>
                </li>
                <li className="p-tabs__item" role="presentation">
                  <button
                    aria-selected={activeConfigTab === `synced-items`}
                    className={`p-tabs__link${activeConfigTab === `synced-items` ? ` is-active` : ``}`}
                    onClick={() => openWorkgraphConfigTab(selectedWorkgraphView.workgraph, `synced-items`)}
                    role="tab"
                    type="button"
                  >
                    Synced Items
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          {activeConfigTab === `jql` ? (
            <Suspense fallback={<p className="p-text--default">Loading JQL...</p>}>
              <LazyLoopWorkgraphConfigJql formik={updateFormik} />
            </Suspense>
          ) : null}

          {activeConfigTab === `labels` ? (
            <Suspense fallback={<p className="p-text--default">Loading labels...</p>}>
              <LazyLoopWorkgraphConfigLabels formik={updateFormik} />
            </Suspense>
          ) : null}

          {activeConfigTab === `item-type-playbooks` ? (
            <Suspense fallback={<p className="p-text--default">Loading item type playbooks...</p>}>
              <LazyLoopWorkgraphConfigTypePlaybooks formik={updateFormik} issueTypeState={issueTypeState} />
            </Suspense>
          ) : null}

          {activeConfigTab === `webhook-definitions` ? (
            <Suspense fallback={<p className="p-text--default">Loading webhook definitions...</p>}>
              <LazyLoopWorkgraphConfigWebhookDefinitions loopId={loopId} onFeedback={onFeedback} workgraphId={selectedWorkgraphView.workgraph} />
            </Suspense>
          ) : null}

          {activeConfigTab === `synced-items` ? (
            <Suspense fallback={<p className="p-text--default">Loading synced items...</p>}>
              <LazyLoopWorkgraphDetails
                itemListState={workgraphItemListState}
                onStartWorkItem={handleStartWorkItem}
                onSyncWorkItems={handleSyncWorkItems}
                syncInProgress={selectedWorkgraphSyncInProgress}
                startingItemId={startingItemId}
                workOnLabel={readWorkOnLabelFromAssignmentConfig(selectedWorkgraphView.assignmentConfig)}
                workgraph={selectedWorkgraphView}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}

      {activeSubtab !== `definitions` && !selectedWorkgraphView ? (
        <Notification severity={NotificationSeverity.CAUTION} title="Workgraph view not found">
          The selected workgraph tab no longer exists. Switch back to Definitions.
        </Notification>
      ) : null}
    </>
  );
}
