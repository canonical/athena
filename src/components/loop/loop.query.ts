import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoop, fetchLoopList, fetchProviderSelectionPolicy } from "./loop.client.js";
import type { Loop, ProviderSelectionPolicy } from "./loop.schema.js";

export type LoopListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loops: Loop[] };

export type LoopState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loop: Loop };

export type ProviderSelectionPolicyState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; policy: ProviderSelectionPolicy };

export const useLoopList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loops`],
    queryFn: fetchLoopList,
  });

  const state: LoopListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, loops: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loops`] });
  };

  return { state, reload };
};

export const useLoop = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loops`, loopId],
    queryFn: () => fetchLoop(loopId),
  });

  const state: LoopState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, loop: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loops`, loopId] });
  };

  return { state, reload };
};

export const useProviderSelectionPolicy = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopProviderSelectionPolicy`, loopId],
    queryFn: () => fetchProviderSelectionPolicy(loopId),
  });

  const state: ProviderSelectionPolicyState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, policy: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopProviderSelectionPolicy`, loopId] });
  };

  return { state, reload };
};
