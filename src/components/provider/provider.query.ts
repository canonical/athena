import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopProviderList, fetchProviderById, fetchProviderList } from "./provider.client.js";
import type { LoopProvider, Provider } from "./provider.schema.js";

export type ProviderListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; providers: Provider[] };
export type ProviderState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; provider: Provider };
export type LoopProviderListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; providers: LoopProvider[] };

export const useProviderList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`providers`],
    queryFn: fetchProviderList,
  });

  const state: ProviderListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, providers: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`providers`] });
  };

  return { state, reload };
};

export const useProviderById = (providerId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`providers`, providerId],
    queryFn: () => fetchProviderById(providerId),
  });

  const state: ProviderState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, provider: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`providers`, providerId] });
  };

  return { state, reload };
};

export const useLoopProviderList = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopProviders`, loopId],
    queryFn: () => fetchLoopProviderList(loopId),
  });

  const state: LoopProviderListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, providers: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopProviders`, loopId] });
  };

  return { state, reload };
};
