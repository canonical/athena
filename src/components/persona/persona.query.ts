import { useCallback, useEffect, useState } from "react";
import { fetchAllPersonas, fetchPersonaById, fetchPersonaCatalog, fetchPersonas } from "./persona.client.js";
import type { Persona, ReferencePersona } from "./persona.schema.js";

export type PersonasState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; personas: Persona[] };

export type PersonaState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; persona: Persona };

export type CatalogState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; catalog: ReferencePersona[] };

export const usePersonas = (loopId: string | null) => {
  const [state, setState] = useState<PersonasState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!loopId) {
      setState({ status: `success`, personas: [] });
      return;
    }

    let active = true;

    setState({ status: `loading` });

    fetchPersonas(loopId)
      .then((personas) => {
        if (active) {
          setState({ status: `success`, personas });
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

export const useAllPersonas = () => {
  const [state, setState] = useState<PersonasState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchAllPersonas()
      .then((personas) => {
        if (active) {
          setState({ status: `success`, personas });
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

export const usePersonaById = (personaId: string) => {
  const [state, setState] = useState<PersonaState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setState({ status: `loading` });

    fetchPersonaById(personaId)
      .then((persona) => {
        if (active) {
          setState({ status: `success`, persona });
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
  }, [personaId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { state, reload };
};

export const usePersonaCatalog = () => {
  const [state, setState] = useState<CatalogState>({ status: `loading` });

  useEffect(() => {
    let active = true;

    fetchPersonaCatalog()
      .then((catalog) => {
        if (active) {
          setState({ status: `success`, catalog });
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
  }, []);

  return state;
};
