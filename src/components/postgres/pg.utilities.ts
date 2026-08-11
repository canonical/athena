export const pgColumns = (names: ReadonlyArray<string>, scope?: string): string => names.map((col) => (scope ? `${scope}."${col}"` : `"${col}"`)).join(`, `);
