import { authenticatedFetch } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Persona, PersonaInsert, PersonaUpdate } from "./persona.schema.js";

export const personaApiPaths = {
  catalog: getApiUrl(`/persona/catalog`),
  globalList: getApiUrl(`/persona-list`),
  globalById: (personaId: string) => getApiUrl(`/persona/${personaId}`),
  list: (loopId: string) => getApiUrl(`/loop/${loopId}/persona-list`),
  loopAssignments: (loopId: string) => getApiUrl(`/persona-list?loop=${loopId}`),
  loopPersonaById: (loopId: string, personaId: string) => getApiUrl(`/loop/${loopId}/persona/${personaId}`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchPersonaCatalog = async (): Promise<Persona[]> => {
  const response = await authenticatedFetch(personaApiPaths.catalog);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona catalog request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaList = async (): Promise<Persona[]> => {
  const response = await authenticatedFetch(personaApiPaths.globalList);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaById = async (personaId: string): Promise<Persona> => {
  const response = await authenticatedFetch(personaApiPaths.globalById(personaId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const fetchLoopPersonaList = async (loopId: string): Promise<Persona[]> => {
  const response = await authenticatedFetch(personaApiPaths.list(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const createPersona = async (payload: PersonaInsert): Promise<Persona> => {
  const response = await authenticatedFetch(personaApiPaths.globalList, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const updatePersona = async (personaId: string, payload: PersonaUpdate): Promise<Persona> => {
  const response = await authenticatedFetch(personaApiPaths.globalById(personaId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona update failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const assignPersonaToLoop = async (loopId: string, personaId: string): Promise<void> => {
  const response = await authenticatedFetch(personaApiPaths.loopAssignments(loopId), {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify({ personaId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona assignment failed with status ${response.status}`));
  }
};

export const deletePersona = async (loopId: string, personaId: string): Promise<void> => {
  const response = await authenticatedFetch(personaApiPaths.loopPersonaById(loopId, personaId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona deletion failed with status ${response.status}`));
  }
};
