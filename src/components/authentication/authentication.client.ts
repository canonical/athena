import { getApiUrl } from "@components/config/frontend.client.js";

export const authenticationApiPaths = {
  login: getApiUrl(`/authentication/login`),
  callback: getApiUrl(`/authentication/callback`),
  logout: getApiUrl(`/authentication/logout`),
  profile: getApiUrl(`/authentication/profile`),
} as const;

export const getAuthenticationLoginPath = (returnTo: string) => `${authenticationApiPaths.login}?returnTo=${encodeURIComponent(returnTo)}`;
