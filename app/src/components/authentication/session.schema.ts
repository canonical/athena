export type AuthUser = {
  id: string;
  name: string;
  email: string;
  picture: string;
  idToken: string;
  accessToken: string;
};

export type SessionData = {
  user?: AuthUser;
  returnTo?: string;
  [key: string]: unknown;
};
