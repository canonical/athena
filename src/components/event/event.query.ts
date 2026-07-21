import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "./event.client.js";
import type { Event } from "./event.schema.js";

export type EventsState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; events: Event[] };

export const useEvents = (): EventsState => {
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`events`],
    queryFn: fetchEvents,
  });

  if (isPending) return { status: `loading` };
  if (isError) return { status: `error`, message: error instanceof Error ? error.message : String(error) };
  return { status: `success`, events: data };
};
