import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
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

export const loopApiPaths = {
  list: getApiUrl(`/loop`),
  byId: (loopId: string) => getApiUrl(`/loop/${loopId}`),
  members: (loopId: string) => getApiUrl(`/loop/${loopId}/users`),
  invite: (loopId: string) => getApiUrl(`/loop/${loopId}/invite`),
  inviteById: (loopId: string, inviteId: string) => getApiUrl(`/loop/${loopId}/invite/${inviteId}`),
  pendingInvites: getApiUrl(`/loop/invite/pending`),
  acceptInvite: (inviteId: string) => getApiUrl(`/loop/invite/${inviteId}/accept`),
  rejectInvite: (inviteId: string) => getApiUrl(`/loop/invite/${inviteId}/reject`),
  memberAdmin: (loopId: string) => getApiUrl(`/loop/${loopId}/user/admin`),
  tools: (loopId: string) => getApiUrl(`/loop/${loopId}/tools`),
  providerSelectionPolicy: (loopId: string) => getApiUrl(`/loop/${loopId}/provider-selection-policy`),
  readiness: (loopId: string) => getApiUrl(`/loop/${loopId}/readiness`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchLoopList = async (): Promise<Loop[]> => {
  const response = await authenticatedJsonGet(loopApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loops request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop[]>;
};

export const fetchLoop = async (loopId: string): Promise<Loop> => {
  const response = await authenticatedJsonGet(loopApiPaths.byId(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const createLoop = async (payload: LoopInsert): Promise<Loop> => {
  const response = await authenticatedJsonPost(loopApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const updateLoop = async (loopId: string, payload: LoopUpdate): Promise<Loop> => {
  const response = await authenticatedJsonPut(loopApiPaths.byId(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop update failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const deleteLoop = async (loopId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(loopApiPaths.byId(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop deletion failed with status ${response.status}`));
  }
};

export const fetchProviderSelectionPolicy = async (loopId: string): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedJsonGet(loopApiPaths.providerSelectionPolicy(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy request failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};

export const updateProviderSelectionPolicy = async (loopId: string, payload: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedJsonPut(loopApiPaths.providerSelectionPolicy(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy update failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};

export const fetchLoopReadiness = async (loopId: string): Promise<LoopReadiness> => {
  const response = await authenticatedJsonGet(loopApiPaths.readiness(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop readiness request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopReadiness>;
};

export const fetchLoopTools = async (loopId: string): Promise<LoopTools> => {
  const response = await authenticatedJsonGet(loopApiPaths.tools(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop tools request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopTools>;
};

export const updateLoopTools = async (loopId: string, payload: LoopToolsUpdateRequest): Promise<LoopTools> => {
  const response = await authenticatedJsonPut(loopApiPaths.tools(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop tools update failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopTools>;
};

export const fetchLoopMembership = async (loopId: string): Promise<LoopMembership> => {
  const response = await authenticatedJsonGet(loopApiPaths.members(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop member request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopMembership>;
};

export const createLoopInvite = async (loopId: string, payload: LoopInviteCreate): Promise<LoopInvite> => {
  const response = await authenticatedJsonPost(loopApiPaths.invite(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop invite creation failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopInvite>;
};

export const revokeLoopInvite = async (loopId: string, inviteId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(loopApiPaths.inviteById(loopId, inviteId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop invite revoke failed with status ${response.status}`));
  }
};

export const updateLoopMemberAdmin = async (loopId: string, payload: LoopUserAdminUpdate): Promise<LoopMember> => {
  const response = await authenticatedJsonPut(loopApiPaths.memberAdmin(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop member role update failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopMember>;
};

export const fetchPendingLoopInvites = async (): Promise<LoopInvite[]> => {
  const response = await authenticatedJsonGet(loopApiPaths.pendingInvites);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Pending loop invite request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopInvite[]>;
};

export const acceptLoopInvite = async (inviteId: string): Promise<LoopMember> => {
  const response = await authenticatedJsonPost(loopApiPaths.acceptInvite(inviteId), {});

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop invite acceptance failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopMember>;
};

export const rejectLoopInvite = async (inviteId: string): Promise<void> => {
  const response = await authenticatedJsonPost(loopApiPaths.rejectInvite(inviteId), {});

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop invite rejection failed with status ${response.status}`));
  }
};
