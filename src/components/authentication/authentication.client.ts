import { getApiUrl } from "@components/config/frontend.client.js";
import { authenticatedFetch } from "./authenticated-fetch.client.js";
import type { AuthenticationProfile } from "./authentication.schema.js";

export const authenticationApiPaths = {
  login: getApiUrl(`/authentication/login`),
  callback: getApiUrl(`/authentication/callback`),
  logout: getApiUrl(`/authentication/logout`),
  profile: getApiUrl(`/authentication/profile`),
} as const;

export const getAuthenticationLoginPath = (returnTo: string) => `${authenticationApiPaths.login}?returnTo=${encodeURIComponent(returnTo)}`;

export const fetchAuthenticationProfile = async (): Promise<AuthenticationProfile> => {
  const response = await authenticatedFetch(authenticationApiPaths.profile, { redirectOnUnauthenticated: false });

  if (!response.ok) {
    throw new Error(`Authentication profile request failed with status ${response.status}`);
  }

  return response.json() as Promise<AuthenticationProfile>;
};
