# Athena deployment note: `VITE_API_BASE_URL`

This note is intentionally scoped to one deployment concern only: frontend API base URL configuration.

## Why this variable matters

Athena frontend code reads `import.meta.env.VITE_API_BASE_URL` in browser-bound code. Because Athena uses Vite, this value is embedded into the frontend bundle at build time.

This means:

- `VITE_API_BASE_URL` is required in the frontend build environment and must be non-empty.
- Changing `VITE_API_BASE_URL` after the bundle is already built does not change the baked client value.

## Recommended deployment usage

Set `VITE_API_BASE_URL` to your backend origin while building frontend assets.

Example:

- Frontend host: `https://athena.example.com`
- Backend host: `https://api.athena.example.com`
- Build-time variable: `VITE_API_BASE_URL=https://api.athena.example.com`

## Local compose requirement

In local Compose, `VITE_API_BASE_URL` must be defined explicitly (for example `http://athenabe.localhost`).
