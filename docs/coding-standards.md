# Athena coding standards

This document is the source of truth for source layout and file organization.

## Folder structure standard

1. Use component-based co-location under `app/src/components`.
2. Each component owns both UI and server-side files for its feature.
3. Each component folder must be flat: files only, no nested folders.
4. Do not create new top-level source split folders like `app/src/frontend` or `app/src/backend`.
5. Keep bootstrap entrypoints `app/src/index.html` and `app/src/server.ts` side-by-side at `app/src`.

Preferred pattern:

```text
app/src/components/
  <component-name>/
    <ComponentName>.tsx
    <componentName>.scss
    <componentName>.router.ts
    <componentName>.schema.ts
    <componentName>.controller.ts
    <ComponentName>List.tsx
    <ComponentName>Edit.tsx
    <ComponentName>Layout.tsx
    <componentName>.query.ts
    <componentName>.client.ts
```

Bootstrap entrypoints:

```text
app/src/
  index.html
  server.ts
```

Notes:

- A component may omit files for either side if it only needs frontend or backend behavior.
- Styles should be component-local. Use `<componentName>.scss` inside each component folder when styling is needed.
- Avoid global styling wherever possible. Introduce global styles only when there is no practical component-scoped alternative.
- `<componentName>.schema.ts` is the only allowed location for that component's TypeScript types and Zod schemas.
- `<componentName>.controller.ts` owns business logic and database interaction for that component.
- `<componentName>.query.ts` owns TanStack Query definitions and uses `<componentName>.client.ts` for HTTP calls.
- Shared cross-component code should live in a clearly named shared location and stay minimal.

## Move and rename standard

1. Use `git mv` whenever possible for tracked files and folders.
2. After moves, update all path-based config (for example, Vite root paths and compose bind mounts).
3. Keep moves and behavior changes in separate commits when practical.

