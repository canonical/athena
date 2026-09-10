import { useQuery } from "@tanstack/react-query";
import { fetchRagIndexState } from "./rag.client.js";

export const useRagIndexState = (loopId: string) =>
  useQuery({
    queryKey: [`ragIndex`, loopId],
    queryFn: () => fetchRagIndexState(loopId),
  });
