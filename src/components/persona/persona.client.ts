import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Persona, PersonaWritable } from "./persona.schema.js";

export const personaApiPaths = {
  catalog: getApiUrl(`/persona/catalog`),
  ownedList: getApiUrl(`/persona`),
  create: getApiUrl(`/persona`),
  delete: getApiUrl(`/persona`),
  globalById: (personaId: string) => getApiUrl(`/persona/${personaId}`),
  list: (loopId: string) => getApiUrl(`/persona/loop/${loopId}/list`),
  assign: getApiUrl(`/persona/assign`),
  unassign: getApiUrl(`/persona/unassign`),
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
  const response = await authenticatedJsonGet(personaApiPaths.catalog);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona catalog request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaList = async (): Promise<Persona[]> => {
  const response = await authenticatedJsonGet(personaApiPaths.ownedList);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaById = async (personaId: string): Promise<Persona> => {
  const response = await authenticatedJsonGet(personaApiPaths.globalById(personaId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const fetchLoopPersonaList = async (loopId: string): Promise<Persona[]> => {
  const response = await authenticatedJsonGet(personaApiPaths.list(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const createPersona = async (payload: PersonaWritable): Promise<Persona> => {
  const response = await authenticatedJsonPost(personaApiPaths.create, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const deletePersona = async (personaId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(personaApiPaths.delete, { body: { persona: personaId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona deletion failed with status ${response.status}`));
  }
};

export const updatePersona = async (personaId: string, payload: PersonaWritable): Promise<Persona> => {
  const response = await authenticatedJsonPut(personaApiPaths.globalById(personaId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona update failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const assignPersonaToLoop = async (loopId: string, personaId: string): Promise<void> => {
  const response = await authenticatedJsonPost(personaApiPaths.assign, { loop: loopId, persona: personaId });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona assignment failed with status ${response.status}`));
  }
};

export const unassignPersonaFromLoop = async (loopId: string, personaId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(personaApiPaths.unassign, { body: { loop: loopId, persona: personaId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona unassignment failed with status ${response.status}`));
  }
};
