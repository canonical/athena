export type AthenaUser = {
  id: string;
  name: string;
  email: string;
  picture: string;
};

export type AuthenticatedUser = AthenaUser & {
  subject: string;
};

export type Session = {
  id?: string;
  returnTo?: string;
};
