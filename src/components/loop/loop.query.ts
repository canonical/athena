import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoop, fetchLoopList, fetchLoopMembership, fetchLoopReadiness, fetchPendingLoopInvites, fetchProviderSelectionPolicy } from "./loop.client.js";
import type { Loop, LoopInvite, LoopMembership, LoopReadiness, ProviderSelectionPolicy } from "./loop.schema.js";

export type LoopListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loops: Loop[] };

export type LoopState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loop: Loop };

export type ProviderSelectionPolicyState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; policy: ProviderSelectionPolicy };
export type LoopReadinessState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; readiness: LoopReadiness };
export type LoopMembershipState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; membership: LoopMembership };
export type LoopInviteListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; invites: LoopInvite[] };

type UseLoopListOptions = {
  enabled?: boolean;
};

export const useLoopList = (options: UseLoopListOptions = {}) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loops`],
    queryFn: fetchLoopList,
    enabled,
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

export const useLoopReadiness = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopReadiness`, loopId],
    queryFn: () => fetchLoopReadiness(loopId),
  });

  const state: LoopReadinessState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, readiness: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopReadiness`, loopId] });
  };

  return { state, reload };
};

export const useLoopMembership = (loopId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopMembers`, loopId],
    queryFn: () => fetchLoopMembership(loopId),
  });

  const state: LoopMembershipState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, membership: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopMembers`, loopId] });
  };

  return { state, reload };
};

export const usePendingLoopInvites = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`pendingLoopInvites`],
    queryFn: fetchPendingLoopInvites,
  });

  const state: LoopInviteListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, invites: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`pendingLoopInvites`] });
  };

  return { state, reload };
};
