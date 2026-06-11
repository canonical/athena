import { useEffect, useState } from "react";
import { fetchEvents } from "./event.client.js";
import type { Event } from "./event.schema.js";

export type EventsState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; events: Event[] };

export const useEvents = (): EventsState => {
  const [state, setState] = useState<EventsState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    fetchEvents()
      .then((events) => {
        if (active) {
          setState({ status: "success", events });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : String(error);
          setState({ status: "error", message });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
};
