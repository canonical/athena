export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectInsert = {
  name: string;
  description?: string;
};

export type ProjectUpdate = {
  name: string;
  description?: string;
};

export type ProjectUser = {
  project: string;
  user: string;
  createdAt: Date;
};
