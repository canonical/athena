import { useQuery } from "@tanstack/react-query";
import { fetchTasks } from "./task.client.js";
import type { Task } from "./task.schema.js";

export type TasksState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; tasks: Task[] };

export const useTasks = (loopId?: string): { state: TasksState; reload: () => void } => {
  const { isPending, isError, data, error, refetch } = useQuery({
    queryKey: [`tasks`, loopId ?? `all`],
    queryFn: () => fetchTasks(loopId),
    enabled: loopId !== undefined,
    // Auto-refresh while queue-processed work is in-flight so chat/task state updates quickly.
    refetchInterval: (query) => {
      const tasks = query.state.data ?? [];
      const hasInFlightWork = tasks.some((task) => task.status === `active` || task.status === `queued` || task.status === `processing`);
      return hasInFlightWork ? 2500 : false;
    },
  });

  if (loopId === undefined) {
    return {
      state: { status: `success`, tasks: [] },
      reload: () => undefined,
    };
  }

  if (isPending) {
    return {
      state: { status: `loading` },
      reload: () => {
        void refetch();
      },
    };
  }

  if (isError) {
    return {
      state: { status: `error`, message: error instanceof Error ? error.message : String(error) },
      reload: () => {
        void refetch();
      },
    };
  }

  return {
    state: { status: `success`, tasks: data },
    reload: () => {
      void refetch();
    },
  };
};
