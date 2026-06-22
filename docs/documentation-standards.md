# Athena documentation standards

This document defines canonical rules for internal documentation under `docs/`.

## Cross-reference standard

1. When referencing another document in `docs/`, use a Markdown link.
2. Do not leave filename-only references such as `handoff.definition.md`; use `[handoff.definition.md](./handoff.definition.md)`.
3. Prefer relative links from the current document location.
4. For references to files in the same directory, use `./<file>.md`.
5. For references to files in sibling directories, use the shortest clear relative path.
6. Keep visible link text equal to the target filename unless a clearer label is needed.

## Scope and ownership

1. Keep normative rules in definition/standards documents and reference them from persona/reference docs.
2. Avoid duplicating policy text across multiple docs.
3. Update links immediately when files are moved or renamed.

## Examples

- Same directory: `[handoff.definition.md](./handoff.definition.md)`
- Parent directory: `[index.md](../index.md)`
- Sibling directory: `[em.diana.persona.md](../personas/em.diana.persona.md)`
