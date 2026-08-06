import { log } from "@components/logging/logging.service.js";
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

  return value.filter((label): label is string => typeof label === `string`).map((label) => label.trim()).filter((label) => label.length > 0);
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

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, ``);

const makeJiraBasicAuthHeader = (email: string, apiKey: string): string => {
  return `Basic ${Buffer.from(`${email}:${apiKey}`, `utf8`).toString(`base64`)}`;
};

const addLabelToJiraIssue = async (input: { baseUrl: string; email: string; apiKey: string; issueId: string; label: string }): Promise<void> => {
  const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/rest/api/3/issue/${encodeURIComponent(input.issueId)}`, {
    method: `PUT`,
    headers: {
      Authorization: makeJiraBasicAuthHeader(input.email, input.apiKey),
      Accept: `application/json`,
      "Content-Type": `application/json`,
    },
    body: JSON.stringify({
      update: {
        labels: [{ add: input.label }],
      },
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    const trimmedResponseText = responseText.trim();
    const message = trimmedResponseText.length > 0 ? trimmedResponseText : response.statusText;
    throw new Error(`Unable to update Jira labels: ${response.status} ${message}`);
  }
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

  await queryLoopWorkgraphReplaceItems(loopId, workgraphId, syncedItems);

  const workgraphItems = await queryLoopWorkgraphItemList(loopId, workgraphId);
  const workOnLabel = readWorkOnLabelFromAssignmentConfig(syncConnection.assignmentConfig);
  const workInProgressLabel = readWorkInProgressLabelFromAssignmentConfig(syncConnection.assignmentConfig);
  const workDoneLabel = readWorkDoneLabelFromAssignmentConfig(syncConnection.assignmentConfig);

  let createdTaskCount = 0;

  for (const workgraphItem of workgraphItems) {
    const labels = parseLabelsFromWorkgraphItemPayload(workgraphItem.payload);

    if (hasLabel(labels, workDoneLabel) || hasLabel(labels, workInProgressLabel) || !hasLabel(labels, workOnLabel)) {
      continue;
    }

    const result = await taskCreate(
      {
        loop: loopId,
        sourceType: `workgraph-webhook`,
        sourceRef: workgraphItem.itemKey,
        description: `Analyze and process Jira item ${workgraphItem.itemKey}: ${workgraphItem.title}`,
        externalRefs: workgraphItem.webUrl ? [workgraphItem.webUrl] : [],
        approvals: [],
        successCriteria: [],
        payload: {
          timeline: [],
          workgraphItem: {
            id: workgraphItem.id,
            itemKey: workgraphItem.itemKey,
            labels,
          },
        },
      },
      undefined, // no userId for system operation
    );

    if (!result?.tasks?.[0]) {
      continue;
    }

    try {
      await addLabelToJiraIssue({
        baseUrl: syncConnection.baseUrl,
        email: syncConnection.email,
        apiKey: syncConnection.apiKey,
        issueId: workgraphItem.itemId,
        label: workInProgressLabel,
      });
    } catch (error) {
      log.warn(`Unable to apply in-progress Jira label after creating task`, {
        loopId,
        workgraphId,
        itemKey: workgraphItem.itemKey,
        error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      });
    }

    createdTaskCount += 1;
  }

  return { syncedCount: syncedItems.length, createdTaskCount };
};
