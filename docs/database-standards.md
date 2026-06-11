# Athena database standards

This document is the source of truth for database schema design and naming conventions.

## Identifier standard

1. Every table that owns its own identity must have an `id` column of type `UUID` with a default of `uuidv7()`.
2. Use UUID v7 rather than v4 or sequential integers. UUID v7 is time-ordered, which keeps indexes efficient and makes row ordering by insertion time possible without a separate timestamp column.
3. Junction tables (many-to-many relations) use a composite primary key of the two foreign-key columns instead of a surrogate `id`.

### Exception: `user.id`

The `user` table uses the OIDC email address as its primary key (`TEXT`). This is intentional: the email is the stable external identity provided by the OIDC provider and is used throughout the system as the user reference. It is not subject to the UUID v7 rule. All other application tables must use UUID v7.

## Naming standard

1. All table names are camelCase: `loop`, `loopUser`, `event`, `session`.
2. All column names are camelCase: `id`, `createdAt`, `workItemUrl`.
3. Do not use snake_case, PascalCase, or UPPER_CASE for table or column names.
4. Junction table names are the camelCase concatenation of the two related table names: `loopUser` (not `loop_user`).
5. Foreign key columns use the referenced table name as the column name, not `<table>Id`. Examples: `event.loop`, `event.user`, `loopUser.loop`.

## Timestamp standard

1. Every mutable table must have `createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()` and `updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
2. Every mutable table must call `ensureUpdatedAtTrigger('<tableName>')` immediately after the `CREATE TABLE` statement to keep `updatedAt` current automatically.
3. Immutable tables (append-only or junction tables) only need `createdAt`; omit `updatedAt` and the trigger.

## Index naming standard

1. Index names follow the pattern `idx{Table}{Column}` in camelCase.
2. Examples: `idxEventLoop`, `idxLoopUserUser`, `idxSessionCreatedAt`.
3. For descending indexes, no suffix is needed: the DESC direction is expressed in the `CREATE INDEX` statement, not the name.

## Permission standard

1. Every table must have a `GRANT` statement at the end of its DDL block that grants `SELECT, INSERT, UPDATE, DELETE` to the application role.
2. Junction tables that are not updated (only inserted and deleted) grant `SELECT, INSERT, DELETE` only.
3. Use the parameterised `format(...)` + `\gexec` pattern already in use so that the role name is injected at migration time.

## Migration file naming standard

1. Migration files are named `{sequence}.{table}.sql` where sequence is a zero-padded six-digit integer.
2. Sequence numbers are multiples of 100 (000100, 000200, 000300, …). This leaves room to insert future migrations between existing ones without renumbering.
3. Tables that depend on another table must have a higher sequence number than the table they reference: `loopUser` (000200, same file as `loop`) depends on `loop` which depends on `user` (000100).
4. All DDL migrations run inside a single transaction defined in `migrate.sql`. Every migration must be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

## Proposed additions

The following rules are recommended for adoption as the schema grows:

- **Soft delete**: prefer an `archivedAt TIMESTAMPTZ` column over hard deletes for user-facing data so that history is preserved.
- **Enum columns**: use `TEXT` with a `CHECK` constraint rather than a Postgres `ENUM` type. Text constraints are easier to migrate without table rewrites.
- **JSONB columns**: always supply a non-null default (`'[]'::jsonb` or `'{}'::jsonb`) so application code can safely assume a value is present.
- **Composite indexes**: when queries filter on multiple columns together, add a composite index in column selectivity order (most selective first).
