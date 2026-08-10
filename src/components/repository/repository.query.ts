import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopRepositoryList, fetchRepositoryById, fetchRepositoryList } from "./repository.client.js";
import type { LoopRepository, Repository } from "./repository.schema.js";

export type RepositoryListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; repositories: Repository[] };
export type RepositoryState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; repository: Repository };
export type LoopRepositoryListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; repositories: LoopRepository[] };

export const useRepositoryList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`repositories`],
    queryFn: fetchRepositoryList,
  });

  const state: RepositoryListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, repositories: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`repositories`] });
  };

  return { state, reload };
};

export const useRepositoryById = (repositoryId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`repositories`, repositoryId],
    queryFn: () => fetchRepositoryById(repositoryId),
  });

  const state: RepositoryState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, repository: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`repositories`, repositoryId] });
  };

  return { state, reload };
};

export const useLoopRepositoryList = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopRepositories`, loopId],
    queryFn: () => fetchLoopRepositoryList(loopId),
  });

  const state: LoopRepositoryListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, repositories: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopRepositories`, loopId] });
  };

  return { state, reload };
};
