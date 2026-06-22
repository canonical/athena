import { getPool } from "@components/postgres/postgres.js";
import { defaultEmPersonality, type Persona, type PersonaAudit, type PersonaInsert, type PersonaUpdate } from "./persona.schema.js";

const personaColumns = `"id", "loop", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority", "createdAt", "updatedAt"`;

export const queryPersonaList = async (loopId: string): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumns}
      FROM "persona"
      WHERE "loop" = $1
      ORDER BY "isEngineeringManager" DESC, "routingPriority" ASC, "createdAt" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryPersonaById = async (personaId: string, loopId: string): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumns}
      FROM "persona"
      WHERE "id" = $1 AND "loop" = $2
    `,
    [personaId, loopId],
  );

  return result.rows[0];
};

export const queryPersonaActiveCount = async (loopId: string): Promise<{ total: number; withCodingHarness: number; engineeringManagers: number }> => {
  const result = await getPool().query<{ total: string; withCodingHarness: string; engineeringManagers: string }>(
    `
      SELECT
        COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE "usesCodingHarness" = TRUE) AS "withCodingHarness",
        COUNT(*) FILTER (WHERE "isEngineeringManager" = TRUE) AS "engineeringManagers"
      FROM "persona"
      WHERE "loop" = $1 AND "lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  const row = result.rows[0];

  if (!row) {
    return { total: 0, withCodingHarness: 0, engineeringManagers: 0 };
  }

  return {
    total: Number(row.total),
    withCodingHarness: Number(row.withCodingHarness),
    engineeringManagers: Number(row.engineeringManagers),
  };
};

export const queryPersonaCreate = async (loopId: string, input: PersonaInsert, isEngineeringManager: boolean): Promise<Persona> => {
  const result = await getPool().query<Persona>(
    `
      INSERT INTO "persona" ("loop", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${personaColumns}
    `,
    [loopId, input.displayName, input.personality, input.usesCodingHarness, isEngineeringManager, input.lifecycleStatus, input.routingPriority],
  );

  const persona = result.rows[0];

  if (!persona) {
    throw new Error(`Persona was not created.`);
  }

  return persona;
};

export const queryPersonaUpdate = async (personaId: string, loopId: string, input: PersonaUpdate): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      UPDATE "persona"
      SET
        "displayName" = $1,
        "personality" = $2,
        "usesCodingHarness" = $3,
        "lifecycleStatus" = $4,
        "routingPriority" = $5
      WHERE "id" = $6 AND "loop" = $7
      RETURNING ${personaColumns}
    `,
    [input.displayName, input.personality, input.usesCodingHarness, input.lifecycleStatus, input.routingPriority, personaId, loopId],
  );

  return result.rows[0];
};

export const queryPersonaDelete = async (personaId: string, loopId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "persona"
      WHERE "id" = $1 AND "loop" = $2
    `,
    [personaId, loopId],
  );

  return Boolean(result.rowCount);
};

export const queryPersonaAuditCreate = async (audit: Omit<PersonaAudit, `id` | `createdAt`>): Promise<void> => {
  await getPool().query(
    `
      INSERT INTO "personaAudit" ("persona", "loop", "actor", "action", "changeSummary", "snapshotBefore", "snapshotAfter")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [audit.persona, audit.loop, audit.actor, audit.action, audit.changeSummary, JSON.stringify(audit.snapshotBefore), JSON.stringify(audit.snapshotAfter)],
  );
};

export const queryPersonaSeedEM = async (loopId: string, client?: import("pg").PoolClient): Promise<Persona> => {
  const pool = client ?? getPool();
  const result = await pool.query<Persona>(
    `
      INSERT INTO "persona" ("loop", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority")
      VALUES ($1, $2, $3, FALSE, TRUE, 'active', 0)
      RETURNING ${personaColumns}
    `,
    [loopId, `Engineering Manager`, defaultEmPersonality],
  );

  const persona = result.rows[0];

  if (!persona) {
    throw new Error(`EM persona seed failed.`);
  }

  return persona;
};
