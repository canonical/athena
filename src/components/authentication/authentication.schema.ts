export type OIDCUserInfo = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
};

export type AuthenticationProfile = {
  isAuthenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    picture: string;
  } | null;
};
