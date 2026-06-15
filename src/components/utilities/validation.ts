import { z } from "zod";

const uuidV7Schema = z.uuid({ version: "v7" });

export const isValidUuid = (value: string): boolean => uuidV7Schema.safeParse(value).success;
