import { queryLoopRepositoryApiConnectionList } from "@components/repository/repository.service.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const parseInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
};

const resolveRepositoryConnectionsForLoop = async (loopId: string) => {
  const connections = await queryLoopRepositoryApiConnectionList(loopId);

  if (connections.length === 0) {
    throw new Error("No enabled repository assignment is available for this loop.");
  }

  for (const connection of connections) {
    if (connection.repositoryType !== "github") {
      throw new Error(`Unsupported repository type: ${connection.repositoryType}.`);
    }
  }

  return connections;
};

const resolveRepositorySelector = (input: Record<string, unknown> | undefined): string | undefined => {
  const repository = typeof input?.repository === "string" && input.repository.trim().length > 0 ? input.repository.trim() : undefined;
  return repository;
};

const resolveRepositoryConnectionForInput = async (loopId: string, input: Record<string, unknown> | undefined) => {
  const connections = await resolveRepositoryConnectionsForLoop(loopId);
  const selector = resolveRepositorySelector(input);

  if (!selector) {
    return connections[0];
  }

  const normalized = selector.toLowerCase();
  const matched = connections.find((connection) => {
    const ownerRepo = `${connection.repositoryOwner}/${connection.repositoryName}`.toLowerCase();
    return connection.repositoryId.toLowerCase() === normalized || connection.displayName.toLowerCase() === normalized || ownerRepo === normalized;
  });

  if (!matched) {
    const available = connections.map((connection) => `${connection.displayName} (${connection.repositoryOwner}/${connection.repositoryName})`).join(", ");
    throw new Error(`Unknown repository selector '${selector}'. Available repositories: ${available}`);
  }

  return matched;
};

const githubRequest = async (connection: { apiBaseUrl: string; apiKey: string }, requestPath: string): Promise<Response> => {
  return fetchWithRetry(
    `${connection.apiBaseUrl.replace(/\/+$/u, "")}${requestPath}`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${connection.apiKey}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    {
      maxAttempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 8_000,
    },
  );
};

const readGithubError = async (response: Response): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? response.statusText;
};

const encodeRepoPath = (value: string): string =>
  value
    .split(`/`)
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join(`/`);

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const buildSymbolRegex = (symbol: string, caseSensitive: boolean): RegExp => {
  const escaped = escapeRegex(symbol);
  const looksLikeIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(symbol);
  const source = looksLikeIdentifier ? `(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])` : escaped;
  return new RegExp(source, caseSensitive ? "u" : "iu");
};

const readRepositoryFileContent = async (responseLoader: () => Promise<Response>): Promise<string | null> => {
  const response = await responseLoader();
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { content?: unknown; encoding?: unknown } | null;
  if (!payload || typeof payload.content !== "string") {
    return null;
  }

  const rawContent = payload.content.replace(/\n/gu, "");
  return payload.encoding === "base64" ? Buffer.from(rawContent, "base64").toString("utf8") : payload.content;
};

export const executeTaskRepositories = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const connections = await resolveRepositoryConnectionsForLoop(context.loopId);

  return {
    total: connections.length,
    repositories: connections.map((connection) => ({
      repositoryId: connection.repositoryId,
      displayName: connection.displayName,
      repositoryType: connection.repositoryType,
      repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
      defaultBranch: connection.defaultBranch,
    })),
  };
};

export const executeRepoLs = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveRepositoryConnectionForInput(context.loopId, input);
  const root = typeof input?.path === "string" ? input.path.trim().replace(/^\/+|\/+$/gu, "") : "";
  const endpointPath =
    root.length > 0
      ? `/repos/${encodeURIComponent(connection.repositoryOwner)}/${encodeURIComponent(connection.repositoryName)}/contents/${encodeRepoPath(root)}`
      : `/repos/${encodeURIComponent(connection.repositoryOwner)}/${encodeURIComponent(connection.repositoryName)}/contents`;
  const response = await githubRequest(connection, endpointPath);

  if (!response.ok) {
    throw new Error(`repo_ls failed (${response.status}): ${await readGithubError(response)}`);
  }

  const payload = (await response.json()) as unknown;
  const items = Array.isArray(payload)
    ? payload.map((entry) => ({
        path: typeof (entry as { path?: unknown }).path === "string" ? String((entry as { path: string }).path) : "",
        type: (entry as { type?: unknown }).type === "dir" ? "dir" : "file",
      }))
    : [];

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    root: root || ".",
    total: items.length,
    items,
  };
};

export const executeRepoRead = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveRepositoryConnectionForInput(context.loopId, input);
  const targetPath = typeof input?.path === "string" ? input.path.trim().replace(/^\/+|\/+$/gu, "") : "";

  if (!targetPath) {
    throw new Error("path is required for repo_read.");
  }

  const startLine = Math.max(1, parseInteger(input?.startLine, 1));
  const endLine = Math.max(startLine, parseInteger(input?.endLine, startLine + 199));
  const maxLines = Math.max(1, Math.min(parseInteger(input?.maxLines, 400), 2000));
  const endpointPath = `/repos/${encodeURIComponent(connection.repositoryOwner)}/${encodeURIComponent(connection.repositoryName)}/contents/${encodeRepoPath(targetPath)}`;
  const response = await githubRequest(connection, endpointPath);

  if (!response.ok) {
    throw new Error(`repo_read failed (${response.status}): ${await readGithubError(response)}`);
  }

  const payload = (await response.json()) as { content?: unknown; encoding?: unknown };

  if (typeof payload.content !== "string") {
    throw new Error("repo_read returned unexpected payload for file content.");
  }

  const rawContent = payload.content.replace(/\n/gu, "");
  const content = payload.encoding === "base64" ? Buffer.from(rawContent, "base64").toString("utf8") : payload.content;
  const allLines = content.split(/\r?\n/u);
  const sliceEnd = Math.min(endLine, startLine + maxLines - 1, allLines.length);
  const lines = allLines.slice(startLine - 1, sliceEnd);

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    path: targetPath,
    startLine,
    endLine: sliceEnd,
    lineCount: lines.length,
    content: lines.join("\n"),
  };
};

export const executeRepoSearch = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const query = typeof input?.query === "string" ? input.query.trim() : "";
  if (!query) {
    throw new Error("query is required for repo_search.");
  }

  const connection = await resolveRepositoryConnectionForInput(context.loopId, input);
  const requestedMaxMatches = Math.max(1, Math.min(parseInteger(input?.maxMatches, 200), 500));
  const perPage = Math.min(requestedMaxMatches, 100);
  const caseSensitive = parseBoolean(input?.caseSensitive, false);
  const pathPrefix = typeof input?.path === "string" ? input.path.trim().replace(/^\/+|\/+$/gu, "") : "";

  const queryParts = [query, `repo:${connection.repositoryOwner}/${connection.repositoryName}`, caseSensitive ? "case:yes" : "case:no"];
  if (pathPrefix.length > 0) {
    queryParts.push(`path:${pathPrefix}`);
  }

  const q = queryParts.join(" ");
  const endpointPath = `/search/code?q=${encodeURIComponent(q)}&per_page=${perPage}`;
  const response = await githubRequest(connection, endpointPath);

  if (!response.ok) {
    throw new Error(`repo_search failed (${response.status}): ${await readGithubError(response)}`);
  }

  const payload = (await response.json()) as { items?: Array<{ path?: string; html_url?: string; sha?: string }> };
  const matches = Array.isArray(payload.items)
    ? payload.items.slice(0, requestedMaxMatches).map((item) => ({
        path: item.path ?? "",
        htmlUrl: item.html_url ?? null,
        sha: item.sha ?? null,
      }))
    : [];

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    query,
    caseSensitive,
    path: pathPrefix || ".",
    requestedMaxMatches,
    effectiveMaxMatches: perPage,
    total: matches.length,
    matches,
  };
};

export const executeRepoFind = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const pattern = typeof input?.pattern === "string" ? input.pattern.trim() : "";
  if (!pattern) {
    throw new Error("pattern is required for repo_find.");
  }

  const flags = typeof input?.flags === "string" ? input.flags.trim() : "";
  const pathPrefix = typeof input?.path === "string" ? input.path.trim().replace(/^\/+|\/+$/gu, "") : "";
  const maxMatches = Math.max(1, Math.min(parseInteger(input?.maxMatches, 200), 1000));
  const connection = await resolveRepositoryConnectionForInput(context.loopId, input);

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags.replace(/[gy]/gu, ""));
  } catch (error) {
    throw new Error(`Invalid regex for repo_find: ${error instanceof Error ? error.message : String(error)}`);
  }

  const branch = connection.defaultBranch || "HEAD";
  const endpointPath = `/repos/${encodeURIComponent(connection.repositoryOwner)}/${encodeURIComponent(connection.repositoryName)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await githubRequest(connection, endpointPath);

  if (!response.ok) {
    throw new Error(`repo_find failed (${response.status}): ${await readGithubError(response)}`);
  }

  const payload = (await response.json()) as {
    truncated?: unknown;
    tree?: Array<{
      path?: unknown;
      type?: unknown;
      sha?: unknown;
      size?: unknown;
      url?: unknown;
    }>;
  };

  const normalizedPrefix = pathPrefix.length > 0 ? `${pathPrefix}/` : "";
  const entries = Array.isArray(payload.tree) ? payload.tree : [];
  const fileEntries = entries.filter((entry): entry is { path: string; type: "blob"; sha?: unknown; size?: unknown; url?: unknown } => entry.type === "blob" && typeof entry.path === "string");

  const matches = fileEntries
    .filter((entry) => (normalizedPrefix ? entry.path.startsWith(normalizedPrefix) : true))
    .filter((entry) => regex.test(entry.path))
    .slice(0, maxMatches)
    .map((entry) => ({
      path: String(entry.path),
      sha: typeof entry.sha === "string" ? entry.sha : null,
      size: typeof entry.size === "number" ? entry.size : null,
      url: typeof entry.url === "string" ? entry.url : null,
    }));

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    branch,
    path: pathPrefix || ".",
    pattern,
    flags,
    total: matches.length,
    truncatedByGithub: payload.truncated === true,
    maxMatches,
    matches,
  };
};

export const executeRepoSymbolIndex = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const symbol = typeof input?.symbol === "string" ? input.symbol.trim() : "";
  if (!symbol) {
    throw new Error("symbol is required for repo_symbol_index.");
  }

  const caseSensitive = parseBoolean(input?.caseSensitive, true);
  const pathPrefix = typeof input?.path === "string" ? input.path.trim().replace(/^\/+|\/+$/gu, "") : "";
  const maxMatches = Math.max(1, Math.min(parseInteger(input?.maxMatches, 100), 200));
  const connection = await resolveRepositoryConnectionForInput(context.loopId, input);
  const regex = buildSymbolRegex(symbol, caseSensitive);

  const queryParts = [symbol, `repo:${connection.repositoryOwner}/${connection.repositoryName}`];
  if (pathPrefix.length > 0) {
    queryParts.push(`path:${pathPrefix}`);
  }

  const candidateLimit = Math.max(maxMatches, Math.min(100, maxMatches * 4));
  const endpointPath = `/search/code?q=${encodeURIComponent(queryParts.join(" "))}&per_page=${candidateLimit}`;
  const response = await githubRequest(connection, endpointPath);

  if (!response.ok) {
    throw new Error(`repo_symbol_index failed (${response.status}): ${await readGithubError(response)}`);
  }

  const payload = (await response.json()) as {
    items?: Array<{ path?: string; sha?: string; html_url?: string }>;
    total_count?: unknown;
    incomplete_results?: unknown;
  };

  const candidates = Array.isArray(payload.items)
    ? payload.items
        .map((item) => ({
          path: typeof item.path === "string" ? item.path : "",
          sha: typeof item.sha === "string" ? item.sha : null,
          htmlUrl: typeof item.html_url === "string" ? item.html_url : null,
        }))
        .filter((item) => item.path.length > 0)
    : [];

  const matches: Array<{
    path: string;
    sha: string | null;
    htmlUrl: string | null;
    hitCount: number;
    hits: Array<{ line: number; preview: string }>;
  }> = [];

  for (const candidate of candidates) {
    if (matches.length >= maxMatches) {
      break;
    }

    const filePath = encodeRepoPath(candidate.path);
    const content = await readRepositoryFileContent(() => githubRequest(connection, `/repos/${encodeURIComponent(connection.repositoryOwner)}/${encodeURIComponent(connection.repositoryName)}/contents/${filePath}`));

    if (content === null) {
      continue;
    }

    const lines = content.split(/\r?\n/u);
    const hits: Array<{ line: number; preview: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
      if (regex.test(lines[index])) {
        hits.push({ line: index + 1, preview: lines[index].slice(0, 240) });
        if (hits.length >= 20) {
          break;
        }
      }
    }

    if (hits.length > 0) {
      matches.push({
        path: candidate.path,
        sha: candidate.sha,
        htmlUrl: candidate.htmlUrl,
        hitCount: hits.length,
        hits,
      });
    }
  }

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    symbol,
    caseSensitive,
    path: pathPrefix || ".",
    maxMatches,
    candidatesConsidered: candidates.length,
    remoteTotalCount: typeof payload.total_count === "number" ? payload.total_count : null,
    incompleteResults: payload.incomplete_results === true,
    total: matches.length,
    matches,
  };
};
