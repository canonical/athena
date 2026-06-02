import { inspectWorkshopEnvironment } from "@components/environment/environment.query.js";
import type { WorkshopEnvironmentSnapshot } from "@components/environment/environment.schemas.js";

let snapshotPromise: Promise<WorkshopEnvironmentSnapshot> | null = null;

const loadEnvironmentSnapshot = async () => {
  const snapshot = await inspectWorkshopEnvironment();

  return snapshot;
};

/**
 * Returns the in-memory workshop environment snapshot, or probes it on first use.
 */
export const getEnvironmentSnapshot = async () => {
  snapshotPromise ??= loadEnvironmentSnapshot();

  return snapshotPromise;
};
