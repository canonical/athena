import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inspectWorkshopEnvironment } from "../environment/environment.query.js";
import { workshopEnvironmentSnapshotSchema } from "../environment/environment.schemas.js";
let snapshotPromise = null;
export const getEnvironmentSnapshotPath = () => {
    return process.env.ATHENA_ENVIRONMENT_SNAPSHOT_PATH ?? join(process.env.HOME ?? `/home/workshop`, `.local`, `state`, `athena`, `environment.json`);
};
const readCachedEnvironmentSnapshot = async () => {
    const snapshotPath = getEnvironmentSnapshotPath();
    const fileContent = await readFile(snapshotPath, `utf8`);
    const parsed = workshopEnvironmentSnapshotSchema.parse(JSON.parse(fileContent));
    return {
        ...parsed,
        source: `cached`,
    };
};
const writeEnvironmentSnapshot = async (snapshot) => {
    const snapshotPath = getEnvironmentSnapshotPath();
    await mkdir(dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, `utf8`);
};
const loadEnvironmentSnapshot = async ({ refresh = false } = {}) => {
    if (!refresh) {
        try {
            return await readCachedEnvironmentSnapshot();
        }
        catch {
            // Fall through to probing when no valid cached snapshot exists yet.
        }
    }
    const snapshot = await inspectWorkshopEnvironment();
    await writeEnvironmentSnapshot(snapshot);
    return snapshot;
};
/**
 * Returns the cached workshop environment snapshot, or probes and caches it on first use.
 */
export const getEnvironmentSnapshot = async ({ refresh = false } = {}) => {
    if (refresh) {
        snapshotPromise = loadEnvironmentSnapshot({ refresh: true });
        return snapshotPromise;
    }
    snapshotPromise ??= loadEnvironmentSnapshot();
    return snapshotPromise;
};
//# sourceMappingURL=environment.service.js.map