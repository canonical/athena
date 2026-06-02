import { load } from "cheerio";
export const OLLAMA_LIBRARY_URL = `https://ollama.com/library`;
const normalizeText = (value) => value?.replace(/\s+/g, ` `).trim() ?? ``;
const toNullableText = (value) => {
    const normalizedValue = normalizeText(value);
    return normalizedValue || null;
};
const toNullableRawText = (value) => {
    const trimmedValue = value?.trim() ?? ``;
    return trimmedValue || null;
};
const toAbsoluteLibraryUrl = (path) => new URL(path, OLLAMA_LIBRARY_URL).toString();
const unique = (values) => Array.from(new Set(values));
const findSection = ($, headingText) => {
    const sectionElement = $(`section`)
        .toArray()
        .find((element) => normalizeText($(element).find(`h2`).first().text()) === headingText);
    return sectionElement ? $(sectionElement) : null;
};
const parseTagCount = (value) => {
    if (!value) {
        return null;
    }
    const parsedValue = Number.parseInt(value, 10);
    return Number.isNaN(parsedValue) ? null : parsedValue;
};
const parseApplications = ($) => {
    const section = findSection($, `Applications`);
    if (!section) {
        return [];
    }
    return section
        .find(`div.group`)
        .toArray()
        .flatMap((element) => {
        const root = $(element);
        const name = toNullableText(root.find(`span.text-sm.font-medium`).first().text());
        const command = toNullableText(root.find(`code`).first().text());
        if (!name || !command) {
            return [];
        }
        const iconPath = root.find(`img`).first().attr(`src`);
        return [
            {
                name,
                command,
                iconUrl: iconPath ? toAbsoluteLibraryUrl(iconPath) : null,
            },
        ];
    });
};
const parseVariants = ($) => {
    const section = findSection($, `Models`);
    if (!section) {
        return [];
    }
    return section
        .find(`a[href^="/library/"]`)
        .toArray()
        .flatMap((element) => {
        const root = $(element);
        const href = root.attr(`href`);
        const name = toNullableText(root.find(`p.text-sm.font-medium`).first().text());
        const descriptor = toNullableText(root.find(`p.flex.text-neutral-500`).first().text());
        if (!href || !name || !descriptor) {
            return [];
        }
        const [sizeOrUsage, contextPart, inputType, updated] = descriptor.split(`·`).map((part) => part.trim());
        const tag = name.includes(`:`) ? name.split(`:`).slice(1).join(`:`) : `latest`;
        const isLatest = root
            .find(`span`)
            .toArray()
            .some((badge) => normalizeText($(badge).text()).toLowerCase() === `latest`);
        return [
            {
                name,
                tag,
                href: toAbsoluteLibraryUrl(href),
                sizeOrUsage: sizeOrUsage || null,
                contextWindow: contextPart?.replace(/\s+context window$/i, ``) || null,
                inputType: inputType || null,
                updated: updated || null,
                isLatest,
            },
        ];
    });
};
const parseReadmeMarkdown = ($) => toNullableRawText($(`#editor`).text());
const parseLicense = ($) => {
    const heading = $(`h2`)
        .toArray()
        .find((element) => normalizeText($(element).text()) === `License/Terms of Use`);
    if (!heading) {
        return {
            label: null,
            href: null,
            text: null,
        };
    }
    const paragraph = $(heading).nextAll(`p`).first();
    const link = paragraph.find(`a`).first();
    return {
        label: toNullableText(link.text()),
        href: link.attr(`href`) ?? null,
        text: toNullableText(paragraph.text()),
    };
};
/**
 * Parses the Ollama library index page into normalized model summaries.
 */
export const parseOllamaLibraryIndex = (html) => {
    const $ = load(html);
    return $(`li[x-test-model]`)
        .toArray()
        .flatMap((element) => {
        const root = $(element);
        const href = root.find(`a[href^="/library/"]`).first().attr(`href`);
        if (!href) {
            return [];
        }
        const slug = href.replace(/^\/library\//, ``);
        const name = toNullableText(root.find(`[x-test-model-title]`).first().attr(`title`)) ?? slug;
        const updatedElement = root.find(`span[title]`).last();
        return [
            {
                slug,
                name,
                href: toAbsoluteLibraryUrl(href),
                summary: toNullableText(root.find(`p.max-w-lg`).first().text()),
                capabilities: unique(root
                    .find(`[x-test-capability]`)
                    .toArray()
                    .map((capability) => toNullableText($(capability).text()))
                    .filter((capability) => Boolean(capability))),
                parameterSizes: unique(root
                    .find(`[x-test-size]`)
                    .toArray()
                    .map((size) => toNullableText($(size).text()))
                    .filter((size) => Boolean(size))),
                downloads: toNullableText(root.find(`[x-test-pull-count]`).first().text()),
                tagCount: parseTagCount(toNullableText(root.find(`[x-test-tag-count]`).first().text())),
                updatedRelative: toNullableText(root.find(`[x-test-updated]`).first().text()),
                updatedTitle: toNullableText(updatedElement.attr(`title`)),
            },
        ];
    });
};
/**
 * Parses a single Ollama library detail page into the normalized catalog shape.
 */
export const parseOllamaLibraryDetailPage = (html, indexEntry) => {
    const $ = load(html);
    const readmeMarkdown = parseReadmeMarkdown($);
    const readmeHeading = readmeMarkdown?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
    const metaTitle = toNullableText($(`meta[property='og:title']`).attr(`content`));
    const modelName = readmeHeading ?? metaTitle ?? indexEntry.name;
    return {
        slug: indexEntry.slug,
        name: modelName,
        href: indexEntry.href,
        summary: toNullableText($(`meta[name='description']`).attr(`content`)) ?? indexEntry.summary,
        capabilities: indexEntry.capabilities,
        parameterSizes: indexEntry.parameterSizes,
        downloads: indexEntry.downloads,
        tagCount: indexEntry.tagCount,
        updated: {
            relative: indexEntry.updatedRelative,
            title: indexEntry.updatedTitle,
        },
        applications: parseApplications($),
        variants: parseVariants($),
        readmeMarkdown,
        license: parseLicense($),
        fetchedAt: new Date().toISOString(),
    };
};
//# sourceMappingURL=ollama-library.parser.js.map