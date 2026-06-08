const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!rawApiBaseUrl) {
  throw new Error(`VITE_API_BASE_URL is required and must be non-empty.`);
}

// Keep URLs predictable by removing trailing slashes from the configured base.
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, ``);

export const frontendApiBaseUrl = normalizedApiBaseUrl;

export const getApiUrl = (path: `/${string}`) => `${frontendApiBaseUrl}${path}`;
