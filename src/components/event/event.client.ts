import { getApiUrl } from "@components/config/frontend.client.js";
import type { Event } from "./event.schema.js";

export const eventApiPaths = {
  list: getApiUrl(`/loop/events`),
} as const;

export const fetchEvents = async (): Promise<Event[]> => {
  const response = await fetch(eventApiPaths.list, { credentials: `include` });

  if (!response.ok) {
    throw new Error(`Events request failed with status ${response.status}`);
  }

  return response.json() as Promise<Event[]>;
};
