import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoopRunnerSessionsResult } from "./runner.client.js";
import { fetchLoopRunnerList, fetchLoopRunnerRepositoryList, fetchLoopRunnerSessions, fetchRunnerById, fetchRunnerInstances, fetchRunnerList, fetchRunnerTokens } from "./runner.client.js";
import type { LoopRunner, LoopRunnerRepository, Runner, RunnerInstance, RunnerToken } from "./runner.schema.js";

export type RunnerListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; runners: Runner[] };
export type RunnerState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; runner: Runner };
export type LoopRunnerListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; runners: LoopRunner[] };
export type LoopRunnerRepositoryListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; repositories: LoopRunnerRepository[] };
export type LoopRunnerSessionsState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: LoopRunnerSessionsResult };
export type RunnerTokensState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; tokens: RunnerToken[] };
export type RunnerInstancesState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; instances: RunnerInstance[] };

export const useRunnerList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`runners`],
    queryFn: fetchRunnerList,
  });

  const state: RunnerListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, runners: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`runners`] });
  };

  return { state, reload };
};

export const useRunnerTokens = (runnerId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({ queryKey: [`runnerTokens`, runnerId], queryFn: () => fetchRunnerTokens(runnerId) });
  const state: RunnerTokensState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, tokens: data };
  const reload = () => void queryClient.invalidateQueries({ queryKey: [`runnerTokens`, runnerId] });
  return { state, reload };
};

export const useRunnerInstances = (runnerId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({ queryKey: [`runnerInstances`, runnerId], queryFn: () => fetchRunnerInstances(runnerId), refetchInterval: 15_000 });
  const state: RunnerInstancesState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, instances: data };
  const reload = () => void queryClient.invalidateQueries({ queryKey: [`runnerInstances`, runnerId] });
  return { state, reload };
};

export const useRunnerById = (runnerId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`runners`, runnerId],
    queryFn: () => fetchRunnerById(runnerId),
  });

  const state: RunnerState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, runner: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`runners`, runnerId] });
  };

  return { state, reload };
};

export const useLoopRunnerList = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopRunners`, loopId],
    queryFn: () => fetchLoopRunnerList(loopId),
  });

  const state: LoopRunnerListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, runners: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopRunners`, loopId] });
  };

  return { state, reload };
};

export const useLoopRunnerSessions = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopRunnerSessions`, loopId],
    queryFn: () => fetchLoopRunnerSessions(loopId),
    refetchInterval: 30_000,
  });

  const state: LoopRunnerSessionsState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopRunnerSessions`, loopId] });
  };

  return { state, reload };
};

export const useLoopRunnerRepositoryList = (loopId: string, runnerId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopRunnerRepositories`, loopId, runnerId],
    queryFn: () => fetchLoopRunnerRepositoryList(loopId, runnerId),
  });

  const state: LoopRunnerRepositoryListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, repositories: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopRunnerRepositories`, loopId, runnerId] });
  };

  return { state, reload };
};
