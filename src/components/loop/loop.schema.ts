export type Loop = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LoopInsert = {
  name: string;
  description?: string;
};

export type LoopUpdate = {
  name: string;
  description?: string;
};

export type LoopUser = {
  loop: string;
  user: string;
  isAdmin: boolean;
  createdAt: Date | string;
};
