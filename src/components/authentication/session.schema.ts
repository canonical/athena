import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  picture: z.string(),
});

export const authenticatedUserSchema = userSchema.extend({
  subject: z.string(),
});

export const sessionSchema = z.object({
  id: z.string().optional(),
  returnTo: z.string().optional(),
});

export type User = z.infer<typeof userSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type Session = z.infer<typeof sessionSchema>;
