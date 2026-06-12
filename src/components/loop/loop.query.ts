import { useCallback, useEffect, useState } from "react";
import { fetchLoops } from "./loop.client.js";
import type { Loop } from "./loop.schema.js";

export type LoopsState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loops: Loop[] };

export const useLoops = () => {
  const [state, setState] = useState<LoopsState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    fetchLoops()
      .then((loops) => {
        if (active) {
          setState({ status: `success`, loops });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : String(error);
          setState({ status: `error`, message });
        }
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setState({ status: `loading` });
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};
