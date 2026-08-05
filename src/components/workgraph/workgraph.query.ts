import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopWorkgraphIssueTypes, fetchLoopWorkgraphItems, fetchLoopWorkgraphList, fetchWorkgraphById, fetchWorkgraphList, fetchWorkgraphTypeOptions } from "./workgraph.client.js";
import type { LoopWorkgraph, LoopWorkgraphItem, Workgraph, WorkgraphIssueType, WorkgraphTypeOption } from "./workgraph.schema.js";

export type WorkgraphListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; workgraphs: Workgraph[] };
export type WorkgraphState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; workgraph: Workgraph };
export type WorkgraphTypeOptionState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; options: WorkgraphTypeOption[] };
export type LoopWorkgraphListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; workgraphs: LoopWorkgraph[] };
export type LoopWorkgraphItemListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; items: LoopWorkgraphItem[] };
export type LoopWorkgraphIssueTypeState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; issueTypes: WorkgraphIssueType[] };

export const useWorkgraphTypeOptions = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`workgraphTypes`],
    queryFn: fetchWorkgraphTypeOptions,
  });

  const state: WorkgraphTypeOptionState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, options: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`workgraphTypes`] });
  };

  return { state, reload };
};

export const useWorkgraphList = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`workgraphs`],
    queryFn: fetchWorkgraphList,
  });

  const state: WorkgraphListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, workgraphs: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`workgraphs`] });
  };

  return { state, reload };
};

export const useWorkgraphById = (workgraphId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`workgraphs`, workgraphId],
    queryFn: () => fetchWorkgraphById(workgraphId),
  });

  const state: WorkgraphState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, workgraph: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`workgraphs`, workgraphId] });
  };

  return { state, reload };
};

export const useLoopWorkgraphList = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopWorkgraphs`, loopId],
    queryFn: () => fetchLoopWorkgraphList(loopId),
  });

  const state: LoopWorkgraphListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, workgraphs: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopWorkgraphs`, loopId] });
  };

  return { state, reload };
};

export const useLoopWorkgraphItems = (loopId: string, workgraphId: string | null) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopWorkgraphItems`, loopId, workgraphId],
    queryFn: () => fetchLoopWorkgraphItems(loopId, workgraphId ?? ``),
    enabled: Boolean(workgraphId),
  });

  const state: LoopWorkgraphItemListState = !workgraphId
    ? { status: `success`, items: [] }
    : isPending
      ? { status: `loading` }
      : isError
        ? { status: `error`, message: error instanceof Error ? error.message : String(error) }
        : { status: `success`, items: data };

  const reload = () => {
    if (!workgraphId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: [`loopWorkgraphItems`, loopId, workgraphId] });
  };

  return { state, reload };
};

export const useLoopWorkgraphIssueTypes = (loopId: string, workgraphId: string | null) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopWorkgraphIssueTypes`, loopId, workgraphId],
    queryFn: () => fetchLoopWorkgraphIssueTypes(loopId, workgraphId ?? ``),
    enabled: Boolean(workgraphId),
  });

  const state: LoopWorkgraphIssueTypeState = !workgraphId
    ? { status: `success`, issueTypes: [] }
    : isPending
      ? { status: `loading` }
      : isError
        ? { status: `error`, message: error instanceof Error ? error.message : String(error) }
        : { status: `success`, issueTypes: data };

  const reload = () => {
    if (!workgraphId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: [`loopWorkgraphIssueTypes`, loopId, workgraphId] });
  };

  return { state, reload };
};
