import { v7 as uuidv7 } from "uuid";

// Process-scoped identity generated once at module load and reused across imports.
const processInstanceId = uuidv7();

export const buildProcessScopedOwner = (prefix: string): string => (prefix ? `${prefix}-${processInstanceId}` : processInstanceId);
