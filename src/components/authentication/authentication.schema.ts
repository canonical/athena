import { z } from "zod";

export const oidcUserInfoSchema = z
  .object({
    sub: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
    picture: z.string().optional(),
  })
  .catchall(z.unknown());

export const authenticationUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  picture: z.string(),
});

export const authenticationProfileSchema = z.object({
  isAuthenticated: z.boolean(),
  user: authenticationUserSchema.nullable(),
});

export type OIDCUserInfo = z.infer<typeof oidcUserInfoSchema>;
export type AuthenticationProfile = z.infer<typeof authenticationProfileSchema>;
