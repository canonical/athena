import { getPool } from "@components/postgres/postgres.js";
import type { Runner } from "./runner.schema.js";

const runnerColumns = `"id", "displayName", "category", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryRunnerList = async (): Promise<Runner[]> => {
  const result = await getPool().query<Runner>(
    `
      SELECT ${runnerColumns}
      FROM "runner"
      ORDER BY "lifecycleStatus" ASC, "createdAt" ASC, "id" ASC
    `,
  );

  return result.rows;
};

export const queryRunnerById = async (runnerId: string): Promise<Runner | undefined> => {
  const result = await getPool().query<Runner>(
    `
      SELECT ${runnerColumns}
      FROM "runner"
      WHERE "id" = $1
    `,
    [runnerId],
  );

  return result.rows[0];
};
