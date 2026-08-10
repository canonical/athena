# Athena coding standards

This document is the source of truth for source layout and file organization.

## Folder structure standard

1. Use component-based co-location under `src/components`.
2. Each component owns both UI and server-side files for its feature.
3. Each component folder must be flat: files only, no nested folders.
4. Do not create new top-level source split folders like `src/frontend` or `src/backend`.
5. Keep bootstrap entrypoints `src/index.html` and `src/server.ts` side-by-side at `src`.

Preferred pattern:

```text
src/components/
  <component-name>/
    <ComponentName>.tsx
    <componentName>.scss
    <componentName>.router.ts
    <componentName>.schema.ts
    <componentName>.controller.ts
    <componentName>.service.ts
    <ComponentName>List.tsx
    <ComponentName>Edit.tsx
    <ComponentName>Layout.tsx
    <componentName>.query.ts
    <componentName>.client.ts
```

Bootstrap entrypoints:

```text
src/
  index.html
  server.ts
```

Notes:

- A component may omit files for either side if it only needs frontend or backend behavior.
- Styles should be component-local. Use `<componentName>.scss` inside each component folder when styling is needed.
- Avoid global styling wherever possible. Introduce global styles only when there is no practical component-scoped alternative.
- `<componentName>.schema.ts` is the only allowed location for that component's TypeScript types and Zod schemas.
- `<componentName>.controller.ts` owns business logic and orchestration for that component.
- `<componentName>.controller.ts` should stay transport-agnostic and must not depend on Express imports except when absolutely necessary.
- Controllers must not query the database directly or fetch other applications/services directly; move that work into service files.
- Define component-specific error classes only in `<componentName>.errors.ts`; do not define custom error classes in controller/service/router/client files.
- Use `<componentName>.service.ts` when a component has one service dependency target, or `<componentName>.<target>.service.ts` when multiple service targets need separate files.
- Prefix controller entrypoint names with the component name, for example `loopGet`, `loopList`, and `taskCreate`.
- Name service functions after their source and action, for example `queryLoopList` for database queries and `fetchLoopList` for external API calls.
- When controller helpers need structured inputs beyond a couple of primitive arguments, define and reuse a named type in `<componentName>.schema.ts` instead of repeating inline object signatures.
- Prefer controller helpers that return explicit values over helpers that mutate shared in-memory state.
- `<componentName>.router.ts` owns Express route definitions and all request/response handling.
- `<componentName>.query.ts` owns TanStack Query definitions and uses `<componentName>.client.ts` for HTTP calls.
- Shared cross-component code should live in a clearly named shared location and stay minimal.

## Move and rename standard

1. Use `git mv` whenever possible for tracked files and folders.
2. After moves, update all path-based config (for example, Vite root paths and compose bind mounts).
3. Keep moves and behavior changes in separate commits when practical.

## Database and type field naming standard

1. For Athena-owned database columns and TypeScript fields that store another record's `id`, use the related entity name, not `<entity>Id`.
2. Examples: `task.loop`, `session.user`, `handler.persona`.
3. This keeps assignments simpler and more semantic: `task.loop = loop.id`.

## Component naming standard

1. Name components after the entity or responsibility they represent, not after their role in the UI.
2. Avoid `View`, `Page`, `Screen`, and similar suffixes unless a component folder contains multiple components that need disambiguation.
3. Use the entity name directly when a component displays or manages that entity: `Loop` not `LoopView`, `Task` not `TaskView`.
4. Use a descriptive suffix only when multiple components coexist in the same folder: `TaskList`, `TaskEdit`, `TaskLayout`.

## Formatting standard

1. Use spaces instead of tabs for indentation.
2. In Markdown files, indent nested list items with two spaces so GitHub renders lists consistently.
3. Use Backticks in strings instead of single or double quotes, except imports. 


## Verification Standard
1. Use `npm run check` & `npm run lint` commands to validate changes. 
2. Use `npm run format:fix` to correct the formatting issues. 

## Forms
1. Use Formik for forms. 

## Routing
1. All the front-end routed components should lazy loaded.

## Application Layout
Application component hierarchy standard is as below:
- Application
  - Side bar
  - Main Area
    - [Entity]Layout.tsx
      - [Entity]List.tsx
      - [Entity].tsx
      - [Entity]Editor.tsx

1. [Entity]Layout.tsx
  - Breadcrumbs on the top, route children right below. No headings, only defines layout & routing.
  - Lazy loaded route
  - Encapsulates without a Card component
  - Provides top-bottom-right-left default paddings to its content & children
  - Route: /[entity]
2. [Entity]List.tsx
  - Lists the existing entities
  - Lazy loaded route
  - Route: /[entity]/list
3. [Entity].tsx
  - Displays read-only version of the entity
  - Lazy loaded route
  - Route: /[entity]/[:id]
4. [Entity]Editor.tsx
  - 2 modes: edit & create
  - Displays entity editor formik form
  - Strictly works within a Drawer (from Canonical React Components)
  - Lazy loaded route
  - Create Mode Route: /[entity]/[anyroute]?create=true
  - Edit Mode Route: /[entity]/[anyroute]?edit=[id]