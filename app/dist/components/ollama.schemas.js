import { z } from "zod";
export const ollamaLibraryApplicationSchema = z.object({
    name: z.string(),
    command: z.string(),
    iconUrl: z.string().nullable(),
});
export const ollamaLibraryVariantSchema = z.object({
    name: z.string(),
    tag: z.string(),
    href: z.string(),
    sizeOrUsage: z.string().nullable(),
    contextWindow: z.string().nullable(),
    inputType: z.string().nullable(),
    updated: z.string().nullable(),
    isLatest: z.boolean(),
});
export const ollamaLibraryModelSchema = z.object({
    slug: z.string(),
    name: z.string(),
    href: z.string(),
    summary: z.string().nullable(),
    capabilities: z.array(z.string()),
    parameterSizes: z.array(z.string()),
    downloads: z.string().nullable(),
    tagCount: z.number().int().nonnegative().nullable(),
    updated: z.object({
        relative: z.string().nullable(),
        title: z.string().nullable(),
    }),
    applications: z.array(ollamaLibraryApplicationSchema),
    variants: z.array(ollamaLibraryVariantSchema),
    readmeMarkdown: z.string().nullable(),
    license: z.object({
        label: z.string().nullable(),
        href: z.string().nullable(),
        text: z.string().nullable(),
    }),
    fetchedAt: z.string(),
});
export const ollamaLibraryCatalogErrorSchema = z.object({
    slug: z.string(),
    message: z.string(),
});
export const ollamaLibraryCatalogSchema = z.object({
    source: z.literal(`https://ollama.com/library`),
    fetchedAt: z.string(),
    models: z.array(ollamaLibraryModelSchema),
    errors: z.array(ollamaLibraryCatalogErrorSchema),
});
//# sourceMappingURL=ollama.schemas.js.map