export const runnerCategories = [`proprietary`, `open`] as const;
export const runnerLifecycleStatuses = [`mvp`, `post-mvp`, `deprecated`] as const;

export type Runner = {
  id: string;
  displayName: string;
  category: (typeof runnerCategories)[number];
  lifecycleStatus: (typeof runnerLifecycleStatuses)[number];
  createdAt: Date | string;
  updatedAt: Date | string;
};
