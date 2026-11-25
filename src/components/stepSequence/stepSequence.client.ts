import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { TaskSource } from "@components/task/task.schema.js";
import type { StepDefinition, StepDefinitionWritable, StepSequence, StepSequenceWritable, TaskSourceStepSequence, TaskSourceStepSequenceWritable } from "./stepSequence.schema.js";

export const stepSequenceApiPaths = {
  list: (loopId: string) => getApiUrl(`/stepSequence/loop/${loopId}/list`),
  create: (loopId: string) => getApiUrl(`/stepSequence/loop/${loopId}`),
  byId: (loopId: string, stepSequenceId: string) => getApiUrl(`/stepSequence/loop/${loopId}/${stepSequenceId}`),
  definitions: (loopId: string, stepSequenceId: string) => getApiUrl(`/stepSequence/loop/${loopId}/${stepSequenceId}/step`),
  reorder: (loopId: string, stepSequenceId: string) => getApiUrl(`/stepSequence/loop/${loopId}/${stepSequenceId}/step/reorder`),
  definition: (loopId: string, stepSequenceId: string, stepDefinitionId: string) => getApiUrl(`/stepSequence/loop/${loopId}/${stepSequenceId}/step/${stepDefinitionId}`),
  mappings: (loopId: string) => getApiUrl(`/stepSequence/loop/${loopId}/mapping/list`),
  mapping: (loopId: string) => getApiUrl(`/stepSequence/loop/${loopId}/mapping`),
  mappingBySource: (loopId: string, taskSource: TaskSource) => getApiUrl(`/stepSequence/loop/${loopId}/mapping/${taskSource}`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

const ensureSuccess = async (response: Response, fallback: string): Promise<void> => {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `${fallback} (status ${response.status})`));
  }
};

const readJson = async <Value>(response: Response, fallback: string): Promise<Value> => {
  await ensureSuccess(response, fallback);
  return response.json() as Promise<Value>;
};

export const fetchStepSequenceList = async (loopId: string): Promise<StepSequence[]> => readJson(await authenticatedJsonGet(stepSequenceApiPaths.list(loopId)), `Step sequences request failed`);

export const createStepSequence = async (loopId: string, payload: StepSequenceWritable): Promise<StepSequence> => readJson(await authenticatedJsonPost(stepSequenceApiPaths.create(loopId), payload), `Step sequence creation failed`);

export const updateStepSequence = async (loopId: string, stepSequenceId: string, payload: StepSequenceWritable): Promise<StepSequence> =>
  readJson(await authenticatedJsonPut(stepSequenceApiPaths.byId(loopId, stepSequenceId), payload), `Step sequence update failed`);

export const deleteStepSequence = async (loopId: string, stepSequenceId: string): Promise<void> => {
  await ensureSuccess(await authenticatedJsonDelete(stepSequenceApiPaths.byId(loopId, stepSequenceId)), `Step sequence deletion failed`);
};

export const fetchStepDefinitionList = async (loopId: string, stepSequenceId: string): Promise<StepDefinition[]> =>
  readJson(await authenticatedJsonGet(stepSequenceApiPaths.definitions(loopId, stepSequenceId)), `Step definitions request failed`);

export const createStepDefinition = async (loopId: string, stepSequenceId: string, payload: StepDefinitionWritable): Promise<StepDefinition> =>
  readJson(await authenticatedJsonPost(stepSequenceApiPaths.definitions(loopId, stepSequenceId), payload), `Step creation failed`);

export const updateStepDefinition = async (loopId: string, stepSequenceId: string, stepDefinitionId: string, payload: StepDefinitionWritable): Promise<StepDefinition> =>
  readJson(await authenticatedJsonPut(stepSequenceApiPaths.definition(loopId, stepSequenceId, stepDefinitionId), payload), `Step update failed`);

export const deleteStepDefinition = async (loopId: string, stepSequenceId: string, stepDefinitionId: string): Promise<void> => {
  await ensureSuccess(await authenticatedJsonDelete(stepSequenceApiPaths.definition(loopId, stepSequenceId, stepDefinitionId)), `Step deletion failed`);
};

export const reorderStepDefinitions = async (loopId: string, stepSequenceId: string, stepDefinitions: string[]): Promise<StepDefinition[]> =>
  readJson(await authenticatedJsonPut(stepSequenceApiPaths.reorder(loopId, stepSequenceId), { stepDefinitions }), `Step reordering failed`);

export const fetchTaskSourceStepSequenceList = async (loopId: string): Promise<TaskSourceStepSequence[]> => readJson(await authenticatedJsonGet(stepSequenceApiPaths.mappings(loopId)), `Task-source mappings request failed`);

export const upsertTaskSourceStepSequence = async (loopId: string, payload: TaskSourceStepSequenceWritable): Promise<TaskSourceStepSequence> =>
  readJson(await authenticatedJsonPut(stepSequenceApiPaths.mapping(loopId), payload), `Task-source mapping update failed`);

export const deleteTaskSourceStepSequence = async (loopId: string, taskSource: TaskSource): Promise<void> => {
  await ensureSuccess(await authenticatedJsonDelete(stepSequenceApiPaths.mappingBySource(loopId, taskSource)), `Task-source mapping deletion failed`);
};
