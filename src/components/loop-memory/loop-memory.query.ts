import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopMemoryConfig } from "./loop-memory.client.js";

export const useLoopMemoryConfig = (loopId: string) => {
  const queryClient = useQueryClient();
  // Indexing status is refresh-driven for now; this query intentionally does not poll.
  const query = useQuery({ queryKey: [`loopHistoryMemory`, loopId], queryFn: () => fetchLoopMemoryConfig(loopId) });
  const reload = async () => queryClient.invalidateQueries({ queryKey: [`loopHistoryMemory`, loopId] });
  return { ...query, reload };
};
