import { log } from "@components/logging/logging.service.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { syncJiraWorkgraphItems } from "@components/workgraph/workgraph.jira.service.js";
import { queryLoopWorkgraphItemList, queryLoopWorkgraphReplaceItems, queryLoopWorkgraphSyncConnection, queryWebhookByReceiverId, queryWebhookItemClaimNext, queryWebhookItemMarkDone, queryWebhookItemRequeue } from "@components/workgraph/workgraph.pg.service.js";
import { queryLoopPersonaList } from "@components/persona/persona.service.js";
import { queryTaskCreateForWorkgraphItem } from "@components/task/task.service.js";
import type { TaskInsert, TaskRoutingMeta } from "@components/task/task.schema.js";

let isProcessing = false;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const defaultAutonomyMaxIterations = 5;

const defaultRoutingMeta: TaskRoutingMeta = {
  routeAttempts: 0,
  lastRoutedAt: null,
  lastRoutedByPersona: null,
  lastRouteReasonCode: null,
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

const resolveActiveRoutingPersona = async (loopId: string): Promise<{ id: string; displayName: string }> => {
  const personas = await queryLoopPersonaList(loopId);
  const activeRoutingPersonas = personas.filter((persona) => persona.lifecycleStatus === `active` && persona.isRouting);

  if (activeRoutingPersonas.length !== 1) {
    throw new Error(`This loop must have exactly one active routing persona.`);
  }

  return {
    id: activeRoutingPersonas[0].id,
    displayName: activeRoutingPersonas[0].displayName,
  };
};

const buildWorkgraphTaskInsert = (input: {
  loopId: string;
  routingPersonaId: string;
  routingPersonaDisplayName: string;
  itemKey: string;
  itemTitle: string;
  itemUrl: string | null;
  labels: string[];
}): TaskInsert => ({
  loop: input.loopId,
  phase: `routing`,
  sourceType: `workgraph-webhook`,
  sourceRef: input.itemKey,
  status: `active`,
  assignee: input.routingPersonaId,
  selectedPersona: input.routingPersonaId,
  targetType: null,
  targetId: null,
  routeReasonCode: null,
  routeReasonText: null,
  description: `Analyze and process Jira item ${input.itemKey}: ${input.itemTitle}`,
  kind: `jira-refinement`,
  ownerMode: `mixed`,
  successCriteria: [],
  externalRefs: input.itemUrl ? [input.itemUrl] : [],
  context: `Task created from workgraph item ${input.itemKey}.`,
  routing: defaultRoutingMeta,
  emittedByPersona: input.routingPersonaId,
  blocker: null,
  approvals: [],
  payload: {
    timeline: [],
    routing: {
      selectedPersona: input.routingPersonaId,
      selectedPersonaDisplayName: input.routingPersonaDisplayName,
      routeReasonText: `Automatically routed from workgraph webhook item labels.`,
    },
    workgraphItem: {
      itemKey: input.itemKey,
      labels: input.labels,
    },
  },
  completedAt: null,
  autonomyIterationCount: 0,
  autonomyMaxIterations: defaultAutonomyMaxIterations,
});

const processWebhookItem = async (item: { id: string; payload: Record<string, unknown> }): Promise<void> => {
  const receiverId = typeof item.payload.receiverId === `string` ? item.payload.receiverId : ``;

  if (!receiverId) {
    return;
  }

  const webhook = await queryWebhookByReceiverId(receiverId);

  if (!webhook || !webhook.active) {
    return;
  }

  if (webhook.type !== `workgraph`) {
    return;
  }

  const syncConnection = await queryLoopWorkgraphSyncConnection(webhook.loop, webhook.workgraph);

  if (!syncConnection || !syncConnection.enabled || syncConnection.type !== `jira`) {
    return;
  }

  const jql = readJqlFromAssignmentConfig(syncConnection.assignmentConfig);

  if (jql.length === 0) {
    return;
  }

  const syncedItems = await syncJiraWorkgraphItems({
    baseUrl: syncConnection.baseUrl,
    browseBaseUrl: syncConnection.browseBaseUrl ?? syncConnection.baseUrl,
    email: syncConnection.email,
    apiKey: syncConnection.apiKey,
    jql,
  });

  await queryLoopWorkgraphReplaceItems(webhook.loop, webhook.workgraph, syncedItems);

  const workgraphItems = await queryLoopWorkgraphItemList(webhook.loop, webhook.workgraph);
  const routingPersona = await resolveActiveRoutingPersona(webhook.loop);

  const workOnLabel = readWorkOnLabelFromAssignmentConfig(webhook.assignmentConfig);
  const workInProgressLabel = readWorkInProgressLabelFromAssignmentConfig(webhook.assignmentConfig);
  const workDoneLabel = readWorkDoneLabelFromAssignmentConfig(webhook.assignmentConfig);

  for (const workgraphItem of workgraphItems) {
    const labels = parseLabelsFromWorkgraphItemPayload(workgraphItem.payload);

    if (hasLabel(labels, workDoneLabel) || hasLabel(labels, workInProgressLabel) || !hasLabel(labels, workOnLabel)) {
      continue;
    }

    const createdTask = await queryTaskCreateForWorkgraphItem({
      task: buildWorkgraphTaskInsert({
        loopId: webhook.loop,
        routingPersonaId: routingPersona.id,
        routingPersonaDisplayName: routingPersona.displayName,
        itemKey: workgraphItem.itemKey,
        itemTitle: workgraphItem.title,
        itemUrl: workgraphItem.webUrl,
        labels,
      }),
      workgraphItemId: workgraphItem.id,
    });

    if (!createdTask) {
      continue;
    }

    await addLabelToJiraIssue({
      baseUrl: webhook.baseUrl,
      email: webhook.email,
      apiKey: webhook.apiKey,
      issueId: workgraphItem.itemId,
      label: workInProgressLabel,
    });
  }
};

const processQueue = async (): Promise<void> => {
  while (true) {
    const item = await queryWebhookItemClaimNext();

    if (!item) {
      return;
    }

    try {
      await processWebhookItem(item);
      await queryWebhookItemMarkDone(item.id);
    } catch (error) {
      log.error(`Webhook item processing failed`, {
        itemId: item.id,
        retryCount: item.retryCount,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });

      if (item.retryCount >= 3) {
        await queryWebhookItemMarkDone(item.id);
        continue;
      }

      await queryWebhookItemRequeue(item.id);
    }
  }
};

export const triggerWebhookItemProcessor = (): void => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  void (async () => {
    try {
      await processQueue();
    } catch (error) {
      log.error(`Webhook item processor failed`, {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });
    } finally {
      isProcessing = false;
    }
  })();
};

export const startWebhookItemProcessor = (): void => {
  triggerWebhookItemProcessor();
};
