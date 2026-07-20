import { useCallback, useEffect, useState } from "react";
import { fetchHarnessById, fetchHarnessList, fetchLoopHarnessList } from "./harness.client.js";
import type { Harness, LoopHarness } from "./harness.schema.js";

export type HarnessListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harnesses: Harness[] };
export type HarnessState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harness: Harness };
export type LoopHarnessListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; harnesses: LoopHarness[] };

export const useHarnessList = () => {
  const [state, setState] = useState<HarnessListState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchHarnessList()
      .then((harnesses) => {
        if (active) {
          setState({ status: `success`, harnesses });
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
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};

export const useHarnessById = (harnessId: string) => {
  const [state, setState] = useState<HarnessState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchHarnessById(harnessId)
      .then((harness) => {
        if (active) {
          setState({ status: `success`, harness });
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
  }, [harnessId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};

export const useLoopHarnessList = (loopId: string) => {
  const [state, setState] = useState<LoopHarnessListState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchLoopHarnessList(loopId)
      .then((harnesses) => {
        if (active) {
          setState({ status: `success`, harnesses });
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
