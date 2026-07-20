import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHarnessById, fetchHarnessList, fetchLoopHarnessList } from "./harness.client.js";
import type { Harness, LoopHarness } from "./harness.schema.js";

export type HarnessListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harnesses: Harness[] };
export type HarnessState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harness: Harness };
export type LoopHarnessListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harnesses: LoopHarness[] };

export const useHarnessList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`harnesses`],
    queryFn: fetchHarnessList,
  });

  const state: HarnessListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, harnesses: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`harnesses`] });
  };

  return { state, reload };
};

export const useHarnessById = (harnessId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`harnesses`, harnessId],
    queryFn: () => fetchHarnessById(harnessId),
  });

  const state: HarnessState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, harness: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`harnesses`, harnessId] });
  };

  return { state, reload };
};

export const useLoopHarnessList = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopHarnesses`, loopId],
    queryFn: () => fetchLoopHarnessList(loopId),
  });

  const state: LoopHarnessListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, harnesses: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopHarnesses`, loopId] });
  };

  return { state, reload };
};
