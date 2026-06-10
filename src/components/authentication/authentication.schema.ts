export type OIDCUserInfo = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
};
