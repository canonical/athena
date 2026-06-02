import { z } from "zod";

export const modelLicenseSchema = z.object({
  label: z.string().nullable(),
  href: z.string().nullable(),
  text: z.string().nullable(),
});

export const modelUpsertRecordSchema = z.object({
  source: z.string(),
  slug: z.string(),
  href: z.string(),
  summary: z.string().nullable(),
  capabilities: z.array(z.string()),
  size: z.string().nullable(),
  contextTokens: z.number().int().nonnegative().nullable(),
  inputTypes: z.array(z.string()),
  readmeMarkdown: z.string().nullable(),
  license: modelLicenseSchema,
  fetchedAt: z.string(),
});

export type ModelUpsertRecord = z.infer<typeof modelUpsertRecordSchema>;
