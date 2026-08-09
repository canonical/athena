import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appendTaskUserMessage, approveTaskToolCall, createTask, fetchTask, fetchTasks, rejectTaskToolCall } from "./task.client.js";
import type { Task } from "./task.schema.js";

export type TasksState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; tasks: Task[] };
export type TaskState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; task: Task };

export const taskQueryKeys = {
  list: (loopId: string) => [`tasks`, loopId] as const,
  detail: (loopId: string, taskId: string) => [`task`, loopId, taskId] as const,
};

export const useTasks = (loopId: string): { state: TasksState; reload: () => void } => {
  const { isPending, isError, data, error, refetch } = useQuery({
    queryKey: taskQueryKeys.list(loopId),
    queryFn: () => fetchTasks(loopId),
  });

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

export const useCreateTask = (loopId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createTask({ loop: loopId, title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.list(loopId) });
    },
  });
};

export const useAppendTaskUserMessage = (loopId: string, taskId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => appendTaskUserMessage(loopId, taskId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.list(loopId) });
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(loopId, taskId) });
    },
  });
};

export const useTask = (loopId: string, taskId: string): { state: TaskState; reload: () => void } => {
  const { isPending, isError, data, error, refetch } = useQuery({
    queryKey: taskQueryKeys.detail(loopId, taskId),
    queryFn: () => fetchTask(loopId, taskId),
    refetchInterval: (query) => {
      const task = query.state.data as Task | undefined;

      if (!task) {
        return false;
      }

      return task.status === `completed` ? false : 2_500;
    },
  });

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
    state: { status: `success`, task: data },
    reload: () => {
      void refetch();
    },
  };
};

export const useApproveTaskToolCall = (loopId: string, taskId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queueItemId: string) => approveTaskToolCall(loopId, taskId, queueItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(loopId, taskId) });
    },
  });
};

export const useRejectTaskToolCall = (loopId: string, taskId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queueItemId: string) => rejectTaskToolCall(loopId, taskId, queueItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(loopId, taskId) });
    },
  });
};
