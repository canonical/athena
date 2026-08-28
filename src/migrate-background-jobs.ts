import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { PgBoss } from "pg-boss";

const boss = new PgBoss({
  application_name: `athena-background-job-migration/${backendConfig.runtime.instanceId}`,
  connectionString: backendConfig.database.connectionString,
  connectionTimeoutMillis: backendConfig.database.connectionTimeoutMs,
  max: 1,
  schema: backendConfig.backgroundJobs.schema,
  createSchema: true,
  migrate: true,
  schedule: false,
  supervise: false,
});

try {
  await boss.start();
  const version = await boss.schemaVersion();
  log.info(`Background job schema migration completed`, { schema: backendConfig.backgroundJobs.schema, version });
} finally {
  await boss.stop({ graceful: false });
}
