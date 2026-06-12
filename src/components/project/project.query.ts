import { useCallback, useEffect, useState } from "react";
import { fetchProjects } from "./project.client.js";
import type { Project } from "./project.schema.js";

export type ProjectsState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; projects: Project[] };

export const useProjects = () => {
  const [state, setState] = useState<ProjectsState>({ status: `loading` });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    fetchProjects()
      .then((projects) => {
        if (active) {
          setState({ status: `success`, projects });
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
