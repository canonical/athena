export type OIDCUserInfo = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
};

export type OIDCResult = {
  access_token: string;
  id_token: string;
};
