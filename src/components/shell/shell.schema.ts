export type AuthenticationSearch = {
  returnTo?: string;
};

export type LoopDetailSearch = {
  tab?: `details` | `personas` | `providers`;
  create?: true;
  edit?: string;
  clone?: true;
};

export type LoopListSearch = {
  create?: true;
  edit?: string;
};

export type PersonaListSearch = {
  create?: true;
  edit?: string;
  clone?: true;
};

export type ProviderListSearch = {
  create?: true;
  edit?: string;
};
