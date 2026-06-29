import { getApiUrl } from "@components/config/frontend.client.js";
import type { Persona } from "./persona.schema.js";

export type PersonaPayload = {
  displayName: string;
  personality: string;
  usesCodingHarness: boolean;
  lifecycleStatus: string;
};

export const personaApiPaths = {
  catalog: getApiUrl(`/personas/catalog`),
  globalList: getApiUrl(`/personas`),
  globalById: (personaId: string) => getApiUrl(`/personas/${personaId}`),
  list: (loopId: string) => getApiUrl(`/loops/${loopId}/personas`),
  loopAssignments: (loopId: string) => getApiUrl(`/loops/${loopId}/persona-assignments`),
  loopPersonaById: (loopId: string, personaId: string) => getApiUrl(`/loops/${loopId}/personas/${personaId}`),
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
  const response = await fetch(personaApiPaths.catalog, { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona catalog request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaList = async (): Promise<Persona[]> => {
  const response = await fetch(personaApiPaths.globalList, { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const fetchPersonaById = async (personaId: string): Promise<Persona> => {
  const response = await fetch(personaApiPaths.globalById(personaId), { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const fetchLoopPersonaList = async (loopId: string): Promise<Persona[]> => {
  const response = await fetch(personaApiPaths.list(loopId), { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Personas request failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona[]>;
};

export const createPersona = async (payload: PersonaPayload): Promise<Persona> => {
  const response = await fetch(personaApiPaths.globalList, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const updatePersona = async (personaId: string, payload: PersonaPayload): Promise<Persona> => {
  const response = await fetch(personaApiPaths.globalById(personaId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona update failed with status ${response.status}`));
  }

  return response.json() as Promise<Persona>;
};

export const assignPersonaToLoop = async (loopId: string, personaId: string): Promise<void> => {
  const response = await fetch(personaApiPaths.loopAssignments(loopId), {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify({ personaId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona assignment failed with status ${response.status}`));
  }
};

export const deletePersona = async (loopId: string, personaId: string): Promise<void> => {
  const response = await fetch(personaApiPaths.loopPersonaById(loopId, personaId), {
    method: `DELETE`,
    credentials: `include`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Persona deletion failed with status ${response.status}`));
  }
};
