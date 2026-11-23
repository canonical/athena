import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { fetchLoopPersonaList, fetchPersonaById, fetchPersonaCatalog, fetchPersonaList } from "./persona.client.js";
import type { Persona } from "./persona.schema.js";

export type PersonaListState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; personas: Persona[] };

export type PersonaState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; persona: Persona };

export type CatalogState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; catalog: Persona[] };

type UseQueryOptions = {
  enabled?: boolean;
};

export const usePersonaList = (loopId: string | null) => {
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopPersonas`, loopId],
    queryFn: () => fetchLoopPersonaList(loopId as string),
    enabled: !!loopId,
  });

  let state: PersonaListState;
  if (!loopId) {
    state = { status: `success`, personas: [] };
  } else if (isPending) {
    state = { status: `loading` };
  } else if (isError) {
    state = { status: `error`, message: error instanceof Error ? error.message : String(error) };
  } else {
    state = { status: `success`, personas: data };
  }

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [`loopPersonas`, loopId] });
  }, [loopId, queryClient]);

  return { state, reload };
};

export const usePersonaListAll = (options: UseQueryOptions = {}) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`personas`],
    queryFn: fetchPersonaList,
    enabled,
  });

  let state: PersonaListState;
  if (!enabled) {
    state = { status: `success`, personas: [] };
  } else if (isPending) {
    state = { status: `loading` };
  } else if (isError) {
    state = { status: `error`, message: error instanceof Error ? error.message : String(error) };
  } else {
    state = { status: `success`, personas: data };
  }

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

  let state: PersonaState;
  if (isPending) {
    state = { status: `loading` };
  } else if (isError) {
    state = { status: `error`, message: error instanceof Error ? error.message : String(error) };
  } else {
    state = { status: `success`, persona: data };
  }

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: [`personas`, personaId] });
  };

  return { state, reload };
};

export const usePersonaCatalog = (options: UseQueryOptions = {}): CatalogState => {
  const { enabled = true } = options;
  const { isPending, isError, data, error } = useQuery({
    queryKey: [`personaCatalog`],
    queryFn: fetchPersonaCatalog,
    enabled,
  });

  if (!enabled) return { status: `success`, catalog: [] };
  if (isPending) return { status: `loading` };
  if (isError) return { status: `error`, message: error instanceof Error ? error.message : String(error) };
  return { status: `success`, catalog: data };
};

export const usePersonaNameByIds = (personaIds: string[]) => {
  const uniquePersonaIds = useMemo(() => Array.from(new Set(personaIds.filter(Boolean))), [personaIds]);

  const personaQueries = useQueries({
    queries: uniquePersonaIds.map((personaId) => ({
      queryKey: [`personas`, personaId],
      queryFn: () => fetchPersonaById(personaId),
    })),
  });

  return useMemo(() => {
    return new Map(
      personaQueries.flatMap((query, index) => {
        if (!query.data) {
          return [];
        }

        return [[uniquePersonaIds[index], query.data.displayName] as const];
      }),
    );
  }, [personaQueries, uniquePersonaIds]);
};

export const usePersonaByIds = (personaIds: string[]) => {
  const uniquePersonaIds = useMemo(() => Array.from(new Set(personaIds.filter(Boolean))), [personaIds]);

  const personaQueries = useQueries({
    queries: uniquePersonaIds.map((personaId) => ({
      queryKey: [`personas`, personaId],
      queryFn: () => fetchPersonaById(personaId),
    })),
  });

  return useMemo(() => {
    return new Map(
      personaQueries.flatMap((query, index) => {
        if (!query.data) {
          return [];
        }

        return [[uniquePersonaIds[index], query.data] as const];
      }),
    );
  }, [personaQueries, uniquePersonaIds]);
};
