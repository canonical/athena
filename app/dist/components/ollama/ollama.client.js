import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ollamaLibraryCatalogSchema } from "../ollama/ollama.schemas.js";
import { OLLAMA_LIBRARY_URL, parseOllamaLibraryDetailPage, parseOllamaLibraryIndex } from "../ollama/ollama-library.parser.js";
import ollama from "ollama";
const DEFAULT_LIBRARY_CONCURRENCY = 4;
const DEFAULT_LIBRARY_TIMEOUT_MS = 30_000;
let catalogPromise = null;
const normalizeDate = (value) => {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toISOString();
};
const fetchHtml = async (url, timeoutMs) => {
    const response = await fetch(url, {
        headers: {
            accept: `text/html,application/xhtml+xml`,
        },
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status} for ${url}`);
    }
    return response.text();
};
const mapWithConcurrency = async (values, concurrency, mapper) => {
    const results = new Array(values.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < values.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(values[currentIndex]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
    return results;
};
const getCatalogSnapshotPath = () => {
    return process.env.ATHENA_OLLAMA_CATALOG_PATH ?? join(process.env.HOME ?? `/home/workshop`, `.local`, `state`, `athena`, `ollama-library.json`);
};
const readCachedCatalog = async () => {
    const snapshotPath = getCatalogSnapshotPath();
    const fileContent = await readFile(snapshotPath, `utf8`);
    return ollamaLibraryCatalogSchema.parse(JSON.parse(fileContent));
};
const writeCatalog = async (catalog) => {
    const snapshotPath = getCatalogSnapshotPath();
    await mkdir(dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify(catalog, null, 2)}\n`, `utf8`);
};
const fetchCatalog = async (options = {}) => {
    const concurrency = Math.max(1, options.concurrency ?? DEFAULT_LIBRARY_CONCURRENCY);
    const timeoutMs = options.timeoutMs ?? DEFAULT_LIBRARY_TIMEOUT_MS;
    const fetchedAt = new Date().toISOString();
    const indexHtml = await fetchHtml(OLLAMA_LIBRARY_URL, timeoutMs);
    const indexEntries = parseOllamaLibraryIndex(indexHtml);
    const errors = [];
    const models = (await mapWithConcurrency(indexEntries, concurrency, async (entry) => {
        try {
            const detailHtml = await fetchHtml(entry.href, timeoutMs);
            return parseOllamaLibraryDetailPage(detailHtml, entry);
        }
        catch (error) {
            errors.push({
                slug: entry.slug,
                message: error instanceof Error ? error.message : String(error),
            });
            return {
                slug: entry.slug,
                name: entry.name,
                href: entry.href,
                summary: entry.summary,
                capabilities: entry.capabilities,
                parameterSizes: entry.parameterSizes,
                downloads: entry.downloads,
                tagCount: entry.tagCount,
                updated: {
                    relative: entry.updatedRelative,
                    title: entry.updatedTitle,
                },
                applications: [],
                variants: [],
                readmeMarkdown: null,
                license: {
                    label: null,
                    href: null,
                    text: null,
                },
                fetchedAt,
            };
        }
    }));
    const catalog = ollamaLibraryCatalogSchema.parse({
        source: OLLAMA_LIBRARY_URL,
        fetchedAt,
        models,
        errors,
    });
    await writeCatalog(catalog);
    return catalog;
};
const loadCatalog = async (options = {}) => {
    if (!options.refresh) {
        try {
            return await readCachedCatalog();
        }
        catch {
            // Fall through to refetch when no valid cached catalog exists yet.
        }
    }
    return fetchCatalog(options);
};
/**
 * Athena wrapper over local Ollama runtime metadata and the remote Ollama library catalog.
 */
export const ollamaClient = {
    list: async () => {
        const response = await ollama.list();
        return response.models.map((model) => ({
            name: model.name,
            id: model.digest ?? model.model ?? null,
            size: model.size != null ? `${model.size}` : null,
            modified: normalizeDate(model.modified_at),
        }));
    },
    pull: async (model) => {
        await ollama.pull({ model, stream: false });
    },
    generate: async (request) => {
        const response = await ollama.generate({ ...request, stream: false });
        return response.response;
    },
    catalog: async (options = {}) => {
        if (options.refresh) {
            catalogPromise = loadCatalog({ ...options, refresh: true });
            return catalogPromise;
        }
        catalogPromise ??= loadCatalog(options);
        return catalogPromise;
    },
};
//# sourceMappingURL=ollama.client.js.map