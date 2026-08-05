import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { WorkgraphForbiddenError, WorkgraphNotFoundError, WorkgraphSyncError, WorkgraphValidationError } from "./workgraph.errors.js";
import { addJiraIssueLabel, listJiraIssueTypes, syncJiraWorkgraphItems, testJiraWorkgraphConnection } from "./workgraph.jira.service.js";
import {
  queryLoopWorkgraphAssign,
  queryLoopWorkgraphDelete,
  queryLoopWorkgraphItemById,
  queryLoopWorkgraphItemList,
  queryLoopWorkgraphList,
  queryLoopWorkgraphMarkSyncFailed,
  queryLoopWorkgraphReplaceItems,
  queryLoopWorkgraphSyncConnection,
  queryLoopWorkgraphUpdateByAdmin,
  queryWorkgraphApiConnectionByOwner,
  queryWorkgraphByIdForOwner,
  queryWorkgraphCreate,
  queryWorkgraphDelete,
  queryWorkgraphListByOwner,
  queryWorkgraphUpdate,
} from "./workgraph.pg.service.js";
import type {
  LoopWorkgraph,
  LoopWorkgraphAdminUpdate,
  LoopWorkgraphAssign,
  LoopWorkgraphItem,
  LoopWorkgraphStartItemResult,
  LoopWorkgraphSyncResult,
  Workgraph,
  WorkgraphConnectionTest,
  WorkgraphInsert,
  WorkgraphIssueType,
  WorkgraphTypeOption,
  WorkgraphUpdate,
} from "./workgraph.schema.js";

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new WorkgraphValidationError(`loopId must be a valid UUID.`);
  }
};

const validateWorkgraphId = (workgraphId: string): void => {
  if (!isValidUuid(workgraphId)) {
    throw new WorkgraphValidationError(`workgraphId must be a valid UUID.`);
  }
};

const validateItemId = (itemId: string): void => {
  if (!isValidUuid(itemId)) {
    throw new WorkgraphValidationError(`itemId must be a valid UUID.`);
  }
};

const enforceJiraOnly = (type: string): void => {
  if (type !== `jira`) {
    throw new WorkgraphValidationError(`Only jira type is supported in this phase.`);
  }
};

const readJqlFromAssignmentConfig = (value: unknown): string => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return ``;
  }

  const config = value as Record<string, unknown>;
  return typeof config.jql === `string` ? config.jql.trim() : ``;
};

export const workgraphTypeOptions = (): WorkgraphTypeOption[] => {
  return [{ id: `jira`, label: `Jira`, seedItemTypes: [] }];
};

export const workgraphList = async (ownerId: string): Promise<Workgraph[]> => queryWorkgraphListByOwner(ownerId);

export const workgraphGet = async (workgraphId: string, ownerId: string): Promise<Workgraph> => {
  validateWorkgraphId(workgraphId);

  const workgraph = await queryWorkgraphByIdForOwner(workgraphId, ownerId);

  if (!workgraph) {
    throw new WorkgraphNotFoundError(`Workgraph not found.`);
  }

  return workgraph;
};

export const workgraphCreate = async (input: WorkgraphInsert, ownerId: string): Promise<Workgraph> => {
  enforceJiraOnly(input.type);

  return queryWorkgraphCreate(input, ownerId);
};

export const workgraphUpdate = async (workgraphId: string, ownerId: string, input: WorkgraphUpdate): Promise<Workgraph> => {
  validateWorkgraphId(workgraphId);
  enforceJiraOnly(input.type);

  const updated = await queryWorkgraphUpdate(workgraphId, ownerId, input);

  if (!updated) {
    throw new WorkgraphNotFoundError(`Workgraph not found.`);
  }

  return updated;
};

export const workgraphDelete = async (workgraphId: string, ownerId: string): Promise<void> => {
  validateWorkgraphId(workgraphId);

  if (!(await queryWorkgraphDelete(workgraphId, ownerId))) {
    throw new WorkgraphNotFoundError(`Workgraph not found.`);
  }
};

export const workgraphTestConnection = async (input: WorkgraphConnectionTest): Promise<{ ok: true; message: string }> => {
  enforceJiraOnly(input.type);

  await testJiraWorkgraphConnection(input);

  const projectKey = input.projectKey?.trim();

  return {
    ok: true,
    message: projectKey ? `Jira connection succeeded for project ${projectKey}.` : `Jira connection succeeded.`,
  };
};

export const workgraphTestConnectionById = async (workgraphId: string, ownerId: string): Promise<{ ok: true; message: string }> => {
  validateWorkgraphId(workgraphId);

  const connection = await queryWorkgraphApiConnectionByOwner(workgraphId, ownerId);

  if (!connection) {
    throw new WorkgraphNotFoundError(`Workgraph not found.`);
  }

  enforceJiraOnly(connection.type);

  await testJiraWorkgraphConnection({
    type: `jira`,
    baseUrl: connection.baseUrl,
    projectKey: connection.projectKey,
    email: connection.email,
    apiKey: connection.apiKey,
  });

  const projectKey = connection.projectKey?.trim();

  return {
    ok: true,
    message: projectKey ? `Jira connection succeeded for project ${projectKey}.` : `Jira connection succeeded.`,
  };
};

export const loopWorkgraphList = async (loopId: string, userId: string): Promise<LoopWorkgraph[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  return queryLoopWorkgraphList(loopId);
};

export const workgraphAssign = async (userId: string, input: LoopWorkgraphAssign): Promise<void> => {
  validateLoopId(input.loop);
  validateWorkgraphId(input.workgraph);

  if (!(await queryLoopMembership(input.loop, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  const workgraph = await queryWorkgraphByIdForOwner(input.workgraph, userId);

  if (!workgraph) {
    throw new WorkgraphNotFoundError(`Workgraph not found.`);
  }

  enforceJiraOnly(workgraph.type);

  await queryLoopWorkgraphAssign(input.loop, input.workgraph);
};

export const loopWorkgraphUpdateByAdmin = async (loopId: string, workgraphId: string, userId: string, input: LoopWorkgraphAdminUpdate): Promise<LoopWorkgraph> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new WorkgraphForbiddenError(`Only loop admins may edit workgraph assignments.`);
  }

  const updated = await queryLoopWorkgraphUpdateByAdmin(loopId, workgraphId, input);

  if (!updated) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }

  return updated;
};

export const loopWorkgraphDelete = async (loopId: string, workgraphId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new WorkgraphForbiddenError(`Only loop admins may remove assignments.`);
  }

  if (!(await queryLoopWorkgraphDelete(loopId, workgraphId))) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }
};

export const loopWorkgraphItemList = async (loopId: string, workgraphId: string, userId: string): Promise<LoopWorkgraphItem[]> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  return queryLoopWorkgraphItemList(loopId, workgraphId);
};

export const loopWorkgraphIssueTypes = async (loopId: string, workgraphId: string, userId: string): Promise<WorkgraphIssueType[]> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  const connection = await queryLoopWorkgraphSyncConnection(loopId, workgraphId);

  if (!connection) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }

  enforceJiraOnly(connection.type);

  return listJiraIssueTypes({
    baseUrl: connection.baseUrl,
    projectKey: connection.projectKey,
    email: connection.email,
    apiKey: connection.apiKey,
  });
};

export const loopWorkgraphSync = async (loopId: string, workgraphId: string, userId: string): Promise<LoopWorkgraphSyncResult> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  const connection = await queryLoopWorkgraphSyncConnection(loopId, workgraphId);

  if (!connection) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }

  if (!connection.enabled) {
    throw new WorkgraphValidationError(`Workgraph assignment is disabled.`);
  }

  enforceJiraOnly(connection.type);

  const jql = readJqlFromAssignmentConfig(connection.assignmentConfig);

  if (!jql) {
    throw new WorkgraphValidationError(`JQL is required before syncing.`);
  }

  try {
    const syncedItems = await syncJiraWorkgraphItems({
      baseUrl: connection.baseUrl,
      browseBaseUrl: connection.browseBaseUrl ?? connection.baseUrl,
      email: connection.email,
      apiKey: connection.apiKey,
      jql,
    });

    await queryLoopWorkgraphReplaceItems(loopId, workgraphId, syncedItems);

    return {
      ok: true,
      syncedCount: syncedItems.length,
      message: `Synced ${syncedItems.length} item(s).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await queryLoopWorkgraphMarkSyncFailed(loopId, workgraphId, message);
    throw new WorkgraphSyncError(message);
  }
};

export const loopWorkgraphStartItem = async (loopId: string, workgraphId: string, itemId: string, userId: string): Promise<LoopWorkgraphStartItemResult> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);
  validateItemId(itemId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WorkgraphNotFoundError(`Loop not found.`);
  }

  const item = await queryLoopWorkgraphItemById(loopId, workgraphId, itemId);

  if (!item) {
    throw new WorkgraphNotFoundError(`Synced workgraph item not found.`);
  }

  const connection = await queryLoopWorkgraphSyncConnection(loopId, workgraphId);

  if (!connection) {
    throw new WorkgraphNotFoundError(`Loop workgraph not found.`);
  }

  if (!connection.enabled) {
    throw new WorkgraphValidationError(`Workgraph assignment is disabled.`);
  }

  enforceJiraOnly(connection.type);

  const workOnLabel = readWorkOnLabelFromAssignmentConfig(connection.assignmentConfig);

  await addJiraIssueLabel({
    baseUrl: connection.baseUrl,
    email: connection.email,
    apiKey: connection.apiKey,
    issueKey: item.itemKey,
    label: workOnLabel,
  });

  return {
    ok: true,
    itemKey: item.itemKey,
    label: workOnLabel,
    message: `Added label ${workOnLabel} to ${item.itemKey}.`,
  };
};
