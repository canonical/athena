import { disabledProviderToolNamesFromEnabled, enabledProviderToolNamesFromDisabled, normalizeProviderToolNames, providerToolDefinitions } from "@components/tool/tool.catalog.js";
import { LoopForbiddenError, LoopNotFoundError, LoopValidationError } from "./loop.errors.js";
import { evaluateLoopReadiness } from "./loop.readiness.js";
import type {
  Loop,
  LoopInsert,
  LoopInvite,
  LoopInviteCreate,
  LoopMember,
  LoopMembership,
  LoopReadiness,
  LoopTools,
  LoopToolsUpdateRequest,
  LoopUpdate,
  LoopUserAdminUpdate,
  ProviderSelectionPolicy,
  ProviderSelectionPolicyUpdate,
} from "./loop.schema.js";
import {
  queryLoopAdminCount,
  queryLoopAdminMembership,
  queryLoopCreate,
  queryLoopDelete,
  queryLoopDisabledProviderTools,
  queryLoopDisabledProviderToolsUpdate,
  queryLoopForUser,
  queryLoopInviteAccept,
  queryLoopInviteById,
  queryLoopInviteCreate,
  queryLoopInvitePendingForUser,
  queryLoopInviteReject,
  queryLoopInviteRevoke,
  queryLoopList,
  queryLoopMemberByEmail,
  queryLoopMemberByUserId,
  queryLoopMemberList,
  queryLoopMembership,
  queryLoopPendingInviteList,
  queryLoopProviderSelectionPolicy,
  queryLoopProviderSelectionPolicyUpdate,
  queryLoopReadinessCounts,
  queryLoopReadinessCountsAll,
  queryLoopUpdate,
  queryLoopUserAdminUpdate,
} from "./loop.service.js";

export const loopList = async (userId: string): Promise<Loop[]> => queryLoopList(userId);

export const loopGet = async (loopId: string, userId: string): Promise<Loop> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return loop;
};

export const loopCreate = async (input: LoopInsert, userId: string): Promise<Loop> => queryLoopCreate(input, userId);

export const loopUpdate = async (loopId: string, input: LoopUpdate, userId: string): Promise<Loop> => {
  const loop = await queryLoopUpdate(loopId, input, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return loop;
};

export const loopDelete = async (loopId: string, userId: string): Promise<void> => {
  if (!(await queryLoopDelete(loopId, userId))) {
    throw new LoopNotFoundError(`Loop not found.`);
  }
};

export const loopProviderSelectionPolicyGet = async (loopId: string, userId: string): Promise<ProviderSelectionPolicy> => {
  const policy = await queryLoopProviderSelectionPolicy(loopId, userId);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};

export const loopProviderSelectionPolicyUpdate = async (loopId: string, userId: string, input: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may update provider selection policy.`);
  }

  const policy = await queryLoopProviderSelectionPolicyUpdate(loopId, userId, input);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};

export const loopReadinessGet = async (loopId: string, userId: string): Promise<LoopReadiness> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  const counts = await queryLoopReadinessCounts(loopId);
  return evaluateLoopReadiness(loopId, counts);
};

export const readyLoops = async (): Promise<string[]> => {
  const readinessCounts = await queryLoopReadinessCountsAll();

  return readinessCounts.filter((counts) => !evaluateLoopReadiness(counts.loopId, counts).blocked).map((counts) => counts.loopId);
};

const buildLoopTools = (loopId: string, disabledProviderTools: string[]): LoopTools => {
  const enabledNames = new Set(enabledProviderToolNamesFromDisabled(disabledProviderTools));

  return {
    loop: loopId,
    tools: providerToolDefinitions
      .filter((tool) => tool.configurable !== false)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        enabled: enabledNames.has(tool.name),
        requiresApproval: tool.requiresApproval,
      })),
  };
};

export const loopToolsGet = async (loopId: string, userId: string): Promise<LoopTools> => {
  const disabledProviderTools = await queryLoopDisabledProviderTools(loopId, userId);

  if (!disabledProviderTools) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return buildLoopTools(loopId, disabledProviderTools);
};

export const loopToolsUpdate = async (loopId: string, userId: string, input: LoopToolsUpdateRequest): Promise<LoopTools> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may update tools.`);
  }

  const enabledToolNames = normalizeProviderToolNames(input.enabledToolNames);
  const disabledProviderTools = disabledProviderToolNamesFromEnabled(enabledToolNames);
  const updatedDisabledProviderTools = await queryLoopDisabledProviderToolsUpdate(loopId, userId, disabledProviderTools);

  if (!updatedDisabledProviderTools) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return buildLoopTools(loopId, updatedDisabledProviderTools);
};

export const loopMembershipGet = async (loopId: string, userId: string): Promise<LoopMembership> => {
  if (!(await queryLoopMembership(loopId, userId))) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  const [members, pendingInvites, currentUserMember] = await Promise.all([queryLoopMemberList(loopId), queryLoopPendingInviteList(loopId), queryLoopMemberByUserId(loopId, userId)]);

  return {
    loop: loopId,
    currentUser: userId,
    currentUserIsAdmin: currentUserMember?.isAdmin ?? false,
    members,
    pendingInvites,
  };
};

export const loopInvitePendingForUserList = async (userId: string): Promise<LoopInvite[]> => queryLoopInvitePendingForUser(userId);

export const loopInviteCreate = async (loopId: string, userId: string, input: LoopInviteCreate): Promise<LoopInvite> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may invite users.`);
  }

  const existingMember = await queryLoopMemberByEmail(loopId, input.email);

  if (existingMember) {
    throw new LoopValidationError(`User is already a loop member.`);
  }

  return queryLoopInviteCreate(loopId, userId, input.email);
};

export const loopInviteAccept = async (inviteId: string, userId: string): Promise<LoopMember> => {
  const invite = await queryLoopInviteAccept(inviteId, userId);

  if (!invite) {
    throw new LoopNotFoundError(`Invite not found.`);
  }

  const member = await queryLoopMemberByUserId(invite.loop, userId);

  if (!member) {
    throw new LoopValidationError(`Invite acceptance failed.`);
  }

  return member;
};

export const loopInviteReject = async (inviteId: string, userId: string): Promise<void> => {
  if (!(await queryLoopInviteReject(inviteId, userId))) {
    throw new LoopNotFoundError(`Invite not found.`);
  }
};

export const loopInviteRevoke = async (loopId: string, inviteId: string, userId: string): Promise<void> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may revoke invites.`);
  }

  const invite = await queryLoopInviteById(inviteId);

  if (!invite || invite.loop !== loopId) {
    throw new LoopNotFoundError(`Invite not found.`);
  }

  if (!(await queryLoopInviteRevoke(loopId, inviteId, userId))) {
    throw new LoopNotFoundError(`Invite not found.`);
  }
};

export const loopUserAdminUpdate = async (loopId: string, userId: string, input: LoopUserAdminUpdate): Promise<LoopMember> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may update member roles.`);
  }

  const member = await queryLoopMemberByEmail(loopId, input.user);

  if (!member) {
    throw new LoopNotFoundError(`Loop member not found.`);
  }

  if (member.isAdmin && !input.isAdmin) {
    const adminCount = await queryLoopAdminCount(loopId);

    if (adminCount <= 1) {
      throw new LoopValidationError(`At least one admin is required for every loop.`);
    }
  }

  const updatedMember = await queryLoopUserAdminUpdate(loopId, member.user, userId, input.isAdmin);

  if (!updatedMember) {
    throw new LoopNotFoundError(`Loop member not found.`);
  }

  return updatedMember;
};
