export type User = {
  id: string;
  name: string;
  email: string;
  picture: string;
};

export type AuthenticatedUser = User & {
  subject: string;
};

export type Session = {
  id?: string;
  returnTo?: string;
};
