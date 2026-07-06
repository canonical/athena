import { useCallback, useEffect, useState } from "react";
import { fetchLoop, fetchLoopList, fetchProviderSelectionPolicy } from "./loop.client.js";
import type { Loop, ProviderSelectionPolicy } from "./loop.schema.js";

export type LoopListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loops: Loop[] };

export type LoopState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; loop: Loop };

export type ProviderSelectionPolicyState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; policy: ProviderSelectionPolicy };

export const useLoopList = () => {
  const [state, setState] = useState<LoopListState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    fetchLoopList()
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

export const useLoop = (loopId: string) => {
  const [state, setState] = useState<LoopState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchLoop(loopId)
      .then((loop) => {
        if (active) {
          setState({ status: `success`, loop });
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
  }, [loopId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};

export const useProviderSelectionPolicy = (loopId: string) => {
  const [state, setState] = useState<ProviderSelectionPolicyState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchProviderSelectionPolicy(loopId)
      .then((policy) => {
        if (active) {
          setState({ status: `success`, policy });
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
  }, [loopId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};
