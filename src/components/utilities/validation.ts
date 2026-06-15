import { z } from "zod";

const uuidSchema = z.uuid();

export const isValidUuid = (value: string): boolean => uuidSchema.safeParse(value).success;
