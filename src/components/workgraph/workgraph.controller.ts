import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { WorkgraphForbiddenError, WorkgraphNotFoundError, WorkgraphValidationError } from "./workgraph.errors.js";
import type { LoopWorkgraph, LoopWorkgraphAdminUpdate, LoopWorkgraphAssign, Workgraph, WorkgraphConnectionTest, WorkgraphInsert, WorkgraphTypeOption, WorkgraphUpdate } from "./workgraph.schema.js";
import { testJiraWorkgraphConnection } from "./workgraph.jira.service.js";
import {
  queryLoopWorkgraphAssign,
  queryLoopWorkgraphDelete,
  queryLoopWorkgraphList,
  queryLoopWorkgraphUpdateByAdmin,
  queryWorkgraphByIdForOwner,
  queryWorkgraphCreate,
  queryWorkgraphDelete,
  queryWorkgraphListByOwner,
  queryWorkgraphUpdate,
} from "./workgraph.pg.service.js";

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

const enforceJiraOnly = (type: string): void => {
  if (type !== `jira`) {
    throw new WorkgraphValidationError(`Only jira type is supported in this phase.`);
  }
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
