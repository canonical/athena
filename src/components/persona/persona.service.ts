import { getPool } from "@components/postgres/postgres.js";
import type { PoolClient } from "pg";
import { defaultEmPersonality, type Persona, type PersonaInsert, type PersonaUpdate } from "./persona.schema.js";

const personaColumns = `"id", "loop", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority", "createdAt", "updatedAt"`;

const withActor = async <T>(actor: string, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    await client.query(`SELECT set_config('app.current_actor', $1, true)`, [actor]);
    const result = await fn(client);
    await client.query(`COMMIT`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

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

export const queryPersonaCreate = async (loopId: string, input: PersonaInsert, isEngineeringManager: boolean, actor: string): Promise<Persona> => {
  return withActor(actor, async (client) => {
    const result = await client.query<Persona>(
      `
        INSERT INTO "persona" ("loop", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${personaColumns}
      `,
      [loopId, input.displayName, input.personality, input.usesCodingHarness, isEngineeringManager, input.lifecycleStatus, input.routingPriority],
    );

    const [persona] = result.rows;

    if (!persona) {
      throw new Error(`Persona was not created.`);
    }

    return persona;
  });
};

export const queryPersonaUpdate = async (personaId: string, loopId: string, input: PersonaUpdate, actor: string): Promise<Persona | undefined> => {
  return withActor(actor, async (client) => {
    const result = await client.query<Persona>(
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
  });
};

export const queryPersonaDelete = async (personaId: string, loopId: string, actor: string): Promise<boolean> => {
  return withActor(actor, async (client) => {
    const result = await client.query(
      `
        DELETE FROM "persona"
        WHERE "id" = $1 AND "loop" = $2
      `,
      [personaId, loopId],
    );

    return Boolean(result.rowCount);
  });
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
