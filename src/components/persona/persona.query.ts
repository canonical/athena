import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLoopPersonaList, fetchPersonaById, fetchPersonaCatalog, fetchPersonaList } from "./persona.client.js";
import type { Persona } from "./persona.schema.js";

export type PersonaListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; personas: Persona[] };

export type PersonaState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; persona: Persona };

export type CatalogState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; catalog: Persona[] };

export const usePersonaList = (loopId: string | null) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopPersonas`, loopId],
    queryFn: () => fetchLoopPersonaList(loopId as string),
    enabled: !!loopId,
  });

  const state: PersonaListState = !loopId
    ? { status: `success`, personas: [] }
    : isPending
      ? { status: `loading` }
      : isError
        ? { status: `error`, message: error instanceof Error ? error.message : String(error) }
        : { status: `success`, personas: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`loopPersonas`, loopId] });
  };

  return { state, reload };
};

export const usePersonaListAll = () => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`personas`],
    queryFn: fetchPersonaList,
  });

  const state: PersonaListState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, personas: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`personas`] });
  };

  return { state, reload };
};

export const usePersonaById = (personaId: string) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`personas`, personaId],
    queryFn: () => fetchPersonaById(personaId),
  });

  const state: PersonaState = isPending ? { status: `loading` } : isError ? { status: `error`, message: error instanceof Error ? error.message : String(error) } : { status: `success`, persona: data };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`personas`, personaId] });
  };

  return { state, reload };
};

export const usePersonaCatalog = (): CatalogState => {
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`personaCatalog`],
    queryFn: fetchPersonaCatalog,
  });

  if (isPending) return { status: `loading` };
  if (isError) return { status: `error`, message: error instanceof Error ? error.message : String(error) };
  return { status: `success`, catalog: data };
};
