import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopWorkgraph, Workgraph, WorkgraphConnectionTest, WorkgraphInsert, WorkgraphSeedItem, WorkgraphTypeOption, WorkgraphUpdate } from "./workgraph.schema.js";

export const workgraphApiPaths = {
  list: getApiUrl(`/workgraph`),
  types: getApiUrl(`/workgraph/types`),
  byId: (workgraphId: string) => getApiUrl(`/workgraph/${workgraphId}`),
  test: getApiUrl(`/workgraph/test`),
  loopList: (loopId: string) => getApiUrl(`/workgraph/loop/${loopId}/list`),
  assign: getApiUrl(`/workgraph/assign`),
  loopAssignmentAdmin: (loopId: string, workgraphId: string) => getApiUrl(`/workgraph/loop/${loopId}/${workgraphId}/admin`),
  unassign: getApiUrl(`/workgraph/unassign`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchWorkgraphTypeOptions = async (): Promise<WorkgraphTypeOption[]> => {
  const response = await authenticatedJsonGet(workgraphApiPaths.types);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph type request failed with status ${response.status}`));
  }

  return response.json() as Promise<WorkgraphTypeOption[]>;
};

export const fetchWorkgraphList = async (): Promise<Workgraph[]> => {
  const response = await authenticatedJsonGet(workgraphApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraphs request failed with status ${response.status}`));
  }

  return response.json() as Promise<Workgraph[]>;
};

export const fetchWorkgraphById = async (id: string): Promise<Workgraph> => {
  const response = await authenticatedJsonGet(workgraphApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph request failed with status ${response.status}`));
  }

  return response.json() as Promise<Workgraph>;
};

export const createWorkgraph = async (payload: WorkgraphInsert): Promise<Workgraph> => {
  const response = await authenticatedJsonPost(workgraphApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Workgraph>;
};

export const testWorkgraphConnection = async (payload: WorkgraphConnectionTest): Promise<{ ok: true; message: string }> => {
  const response = await authenticatedJsonPost(workgraphApiPaths.test, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph connection test failed with status ${response.status}`));
  }

  return response.json() as Promise<{ ok: true; message: string }>;
};

export const updateWorkgraph = async (workgraphId: string, payload: WorkgraphUpdate): Promise<Workgraph> => {
  const response = await authenticatedJsonPut(workgraphApiPaths.byId(workgraphId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph update failed with status ${response.status}`));
  }

  return response.json() as Promise<Workgraph>;
};

export const deleteWorkgraph = async (workgraphId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(workgraphApiPaths.list, { body: { workgraph: workgraphId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph deletion failed with status ${response.status}`));
  }
};

export const fetchLoopWorkgraphList = async (loopId: string): Promise<LoopWorkgraph[]> => {
  const response = await authenticatedJsonGet(workgraphApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraphs request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopWorkgraph[]>;
};

export const assignWorkgraphToLoop = async (loopId: string, workgraphId: string): Promise<void> => {
  const response = await authenticatedJsonPost(workgraphApiPaths.assign, { loop: loopId, workgraph: workgraphId });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph assignment failed with status ${response.status}`));
  }
};

export const updateLoopWorkgraphByAdmin = async (
  loopId: string,
  workgraphId: string,
  payload: {
    enabled?: boolean;
    seedItems?: WorkgraphSeedItem[];
    hierarchyRules?: Record<string, unknown>;
    assignmentOverrides?: Record<string, unknown>;
  },
): Promise<LoopWorkgraph> => {
  const response = await authenticatedJsonPut(workgraphApiPaths.loopAssignmentAdmin(loopId, workgraphId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraph update failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopWorkgraph>;
};

export const removeWorkgraphFromLoop = async (loopId: string, workgraphId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(workgraphApiPaths.unassign, { body: { loop: loopId, workgraph: workgraphId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph removal failed with status ${response.status}`));
  }
};
