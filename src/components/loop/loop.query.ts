import { useEffect, useState } from "react";
import { fetchLoopEvents, type LoopEventSummary } from "./loop.client.js";

export type LoopEventsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; events: LoopEventSummary[] };

export const useLoopEvents = (): LoopEventsState => {
  const [state, setState] = useState<LoopEventsState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    fetchLoopEvents()
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
