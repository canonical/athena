import { useCallback, useEffect, useState } from "react";
import { fetchLoopProviderList, fetchProviderById, fetchProviderList } from "./provider.client.js";
import type { LoopProvider, Provider } from "./provider.schema.js";

export type ProviderListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; providers: Provider[] };
export type ProviderState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; provider: Provider };
export type LoopProviderListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; providers: LoopProvider[] };

export const useProviderList = () => {
  const [state, setState] = useState<ProviderListState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchProviderList()
      .then((providers) => {
        if (active) {
          setState({ status: `success`, providers });
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

export const useProviderById = (providerId: string) => {
  const [state, setState] = useState<ProviderState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchProviderById(providerId)
      .then((provider) => {
        if (active) {
          setState({ status: `success`, provider });
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
  }, [providerId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};

export const useLoopProviderList = (loopId: string) => {
  const [state, setState] = useState<LoopProviderListState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchLoopProviderList(loopId)
      .then((providers) => {
        if (active) {
          setState({ status: `success`, providers });
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
