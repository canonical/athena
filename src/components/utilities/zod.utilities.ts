import { preprocess, string, url, z, uuid as zodUuid } from "zod";

const trimToUndefined = (value: unknown): string | undefined => (typeof value === `string` ? value.trim() || undefined : undefined);

const trimToNull = (value: unknown): string | null => (typeof value === `string` ? value.trim() || null : null);

export const requiredString = (message: string) => preprocess(trimToUndefined, string(message));

export const optionalString = preprocess(trimToUndefined, string().optional());

export const normalizedString = preprocess(trimToUndefined, string().optional());

export const nullableString = preprocess(trimToNull, string().nullable());

export const isoDateTime = z.iso.datetime({ offset: true });

export const uuid = (message = `must be a valid UUID.`) => zodUuid({ version: `v7`, error: message }).toLowerCase();

export const httpsUrl = url(`baseUrl must be a valid URL.`).refine((value) => value.startsWith(`https://`), { message: `baseUrl must use HTTPS.` });

export const modelEndpointUrl = url(`baseUrl must be a valid URL.`).refine((value) => value.startsWith(`https://`) || value.startsWith(`http://`), {
  message: `baseUrl must use HTTP or HTTPS.`,
});

export const isValidUuid = (value: string): boolean => uuid().safeParse(value).success;
