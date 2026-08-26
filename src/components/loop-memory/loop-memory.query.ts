import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopMemoryConfig } from "./loop-memory.client.js";

export const useLoopMemoryConfig = (loopId: string) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [`loopHistoryMemory`, loopId],
    queryFn: () => fetchLoopMemoryConfig(loopId),
    refetchInterval: ({ state }) => (state.data?.status === `indexing` ? 1_000 : false),
  });
  const reload = async () => queryClient.invalidateQueries({ queryKey: [`loopHistoryMemory`, loopId] });
  return { ...query, reload };
};
