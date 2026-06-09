export type User = {
  id: string;
  name: string;
  email: string;
  picture: string;
};

export type AuthenticatedUser = User & {
  subject: string;
  idToken: string;
  accessToken: string;
};

export type Session = {
  id?: string;
  returnTo?: string;
};
