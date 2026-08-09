import { taskCreate } from "@components/task/task.controller.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { syncJiraWorkgraphItems } from "@components/workgraph/workgraph.jira.service.js";
import { queryLoopWorkgraphItemList, queryLoopWorkgraphReplaceItems, queryLoopWorkgraphSyncConnection } from "@components/workgraph/workgraph.pg.service.js";
import { WorkgraphNotFoundError, WorkgraphValidationError } from "./workgraph.errors.js";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readJqlFromAssignmentConfig = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return ``;
  }

  const jql = (value as Record<string, unknown>).jql;
  return typeof jql === `string` ? jql.trim() : ``;
};

const hasLabel = (labels: string[], expectedLabel: string): boolean => {
  const normalizedExpected = expectedLabel.trim().toLowerCase();

  if (!normalizedExpected) {
    return false;
  }

  return labels.some((label) => label.trim().toLowerCase() === normalizedExpected);
};

const extractLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((label): label is string => typeof label === `string`)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
};

const parseLabelsFromWorkgraphItemPayload = (payload: unknown): string[] => {
  const payloadRecord = asRecord(payload);

  if (!payloadRecord) {
    return [];
  }

  const issueRecord = asRecord(payloadRecord.issue);
  const issueFields = asRecord(issueRecord?.fields);

  if (issueFields) {
    const labels = extractLabels(issueFields.labels);

    if (labels.length > 0) {
      return labels;
    }
  }

  const payloadFields = asRecord(payloadRecord.fields);

  if (payloadFields) {
    const labels = extractLabels(payloadFields.labels);

    if (labels.length > 0) {
      return labels;
    }
  }

  return extractLabels(payloadRecord.labels);
};

const readPromotedTaskTitle = (itemTitle: string | null, mode: "created" | "updated"): string => {
  const normalizedTitle = typeof itemTitle === "string" ? itemTitle.trim() : "";
  const baseTitle = normalizedTitle.length > 0 ? normalizedTitle : "Workgraph Item";
  return `${baseTitle} ${mode === "updated" ? "Updated" : "Created"}`;
};

export const synchronizeLoopWorkgraphAndPromoteTasks = async (loopId: string, workgraphId: string): Promise<{ syncedCount: number; createdTaskCount: number }> => {
  const syncConnection = await queryLoopWorkgraphSyncConnection(loopId, workgraphId);

  if (!syncConnection) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }

  if (!syncConnection.enabled) {
    throw new WorkgraphValidationError(`Workgraph assignment is disabled.`);
  }

  if (syncConnection.type !== `jira`) {
    throw new WorkgraphValidationError(`Only jira type is supported in this phase.`);
  }

  const jql = readJqlFromAssignmentConfig(syncConnection.assignmentConfig);

  if (jql.length === 0) {
    throw new WorkgraphValidationError(`JQL is required before syncing.`);
  }

  const syncedItems = await syncJiraWorkgraphItems({
    baseUrl: syncConnection.baseUrl,
    browseBaseUrl: syncConnection.browseBaseUrl ?? syncConnection.baseUrl,
    email: syncConnection.email,
    apiKey: syncConnection.apiKey,
    jql,
  });

  const existingItemsBeforeSync = await queryLoopWorkgraphItemList(loopId, workgraphId);
  const existingItemKeySet = new Set<string>();

  for (const item of existingItemsBeforeSync) {
    const itemKey = item.itemKey.trim().toLowerCase();

    if (!itemKey) {
      continue;
    }

    existingItemKeySet.add(itemKey);
  }

  await queryLoopWorkgraphReplaceItems(loopId, workgraphId, syncedItems);

  const workgraphItems = await queryLoopWorkgraphItemList(loopId, workgraphId);
  const workOnLabel = readWorkOnLabelFromAssignmentConfig(syncConnection.assignmentConfig);
  const workInProgressLabel = readWorkInProgressLabelFromAssignmentConfig(syncConnection.assignmentConfig);
  const workDoneLabel = readWorkDoneLabelFromAssignmentConfig(syncConnection.assignmentConfig);

  let createdTaskCount = 0;

  for (const workgraphItem of workgraphItems) {
    const labels = parseLabelsFromWorkgraphItemPayload(workgraphItem.payload);

    if (!hasLabel(labels, workOnLabel) || hasLabel(labels, workInProgressLabel) || hasLabel(labels, workDoneLabel)) {
      continue;
    }

    const itemKey = workgraphItem.itemKey.trim().toLowerCase();
    const existedBeforeSync = itemKey.length > 0 && existingItemKeySet.has(itemKey);
    const titleMode: "created" | "updated" = existedBeforeSync ? "updated" : "created";

    const createdTask = await taskCreate({
      loop: loopId,
      source: `workgraphItem`,
      workgraphItem: workgraphItem.id,
      title: readPromotedTaskTitle(workgraphItem.title, titleMode),
    });

    if (createdTask) {
      createdTaskCount += 1;
    }
  }

  return { syncedCount: syncedItems.length, createdTaskCount };
};
