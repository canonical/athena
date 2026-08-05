import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopWorkgraphWebhooks } from "./webhook.client.js";
import type { LoopWorkgraphWebhook } from "./webhook.schema.js";

export type LoopWorkgraphWebhookListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; webhooks: LoopWorkgraphWebhook[] };

export const useLoopWorkgraphWebhooks = (loopId: string, workgraphId: string | null) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopWorkgraphWebhooks`, loopId, workgraphId],
    queryFn: () => fetchLoopWorkgraphWebhooks(loopId, workgraphId ?? ``),
    enabled: Boolean(workgraphId),
  });

  const state: LoopWorkgraphWebhookListState = !workgraphId
    ? { status: `success`, webhooks: [] }
    : isPending
      ? { status: `loading` }
      : isError
        ? { status: `error`, message: error instanceof Error ? error.message : String(error) }
        : { status: `success`, webhooks: data };

  const reload = () => {
    if (!workgraphId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: [`loopWorkgraphWebhooks`, loopId, workgraphId] });
  };

  return { state, reload };
};
