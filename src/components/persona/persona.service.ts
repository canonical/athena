import { getPool } from "@components/postgres/postgres.js";
import { type Persona, type PersonaInsert, type PersonaUpdate } from "./persona.schema.js";

const personaColumns = `p."id", p."displayName", p."personality", p."usesCodingHarness", p."isEngineeringManager", p."isDefault", p."lifecycleStatus", p."routingPriority", p."createdAt", p."updatedAt"`;

const personaColumnsUnqualified = `"id", "displayName", "personality", "usesCodingHarness", "isEngineeringManager", "isDefault", "lifecycleStatus", "routingPriority", "createdAt", "updatedAt"`;

export const queryPersonaList = async (loopId: string): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumns}
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE lp."loop" = $1
      ORDER BY p."isEngineeringManager" DESC, p."routingPriority" ASC, p."createdAt" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryAllPersonas = async (): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumnsUnqualified}
      FROM "persona"
      ORDER BY "isEngineeringManager" DESC, "routingPriority" ASC, "displayName" ASC
    `,
  );

  return result.rows;
};

export const queryPersonaById = async (personaId: string, loopId: string): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumns}
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE p."id" = $1 AND lp."loop" = $2
    `,
    [personaId, loopId],
  );

  return result.rows[0];
};

export const queryPersonaByIdGlobal = async (personaId: string): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumnsUnqualified}
      FROM "persona"
      WHERE "id" = $1
    `,
    [personaId],
  );

  return result.rows[0];
};

export const queryPersonaActiveCount = async (loopId: string): Promise<{ total: number; withCodingHarness: number; engineeringManagers: number }> => {
  const result = await getPool().query<{ total: string; withCodingHarness: string; engineeringManagers: string }>(
    `
      SELECT
        COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE p."usesCodingHarness" = TRUE) AS "withCodingHarness",
        COUNT(*) FILTER (WHERE p."isEngineeringManager" = TRUE) AS "engineeringManagers"
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE lp."loop" = $1 AND p."lifecycleStatus" = 'active'
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
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const result = await client.query<Persona>(
      `
        INSERT INTO "persona" ("displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${personaColumnsUnqualified}
      `,
      [input.displayName, input.personality, input.usesCodingHarness, isEngineeringManager, input.lifecycleStatus, input.routingPriority],
    );

    const [persona] = result.rows;

    if (!persona) {
      throw new Error(`Persona was not created.`);
    }

    await client.query(`INSERT INTO "loopPersona" ("loop", "persona") VALUES ($1, $2)`, [loopId, persona.id]);
    await client.query(`COMMIT`);

    return persona;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryPersonaCreateGlobal = async (input: PersonaInsert, isEngineeringManager: boolean): Promise<Persona> => {
  const result = await getPool().query<Persona>(
    `
      INSERT INTO "persona" ("displayName", "personality", "usesCodingHarness", "isEngineeringManager", "lifecycleStatus", "routingPriority")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.personality, input.usesCodingHarness, isEngineeringManager, input.lifecycleStatus, input.routingPriority],
  );

  const [persona] = result.rows;

  if (!persona) {
    throw new Error(`Persona was not created.`);
  }

  return persona;
};

export const queryPersonaUpdate = async (personaId: string, loopId: string, input: PersonaUpdate): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      UPDATE "persona" p
      SET
        "displayName" = $1,
        "personality" = $2,
        "usesCodingHarness" = $3,
        "lifecycleStatus" = $4,
        "routingPriority" = $5
      FROM "loopPersona" lp
      WHERE p."id" = $6 AND lp."persona" = p."id" AND lp."loop" = $7
      RETURNING p."id", p."displayName", p."personality", p."usesCodingHarness", p."isEngineeringManager", p."isDefault", p."lifecycleStatus", p."routingPriority", p."createdAt", p."updatedAt"
    `,
    [input.displayName, input.personality, input.usesCodingHarness, input.lifecycleStatus, input.routingPriority, personaId, loopId],
  );

  return result.rows[0];
};

export const queryPersonaUpdateGlobal = async (personaId: string, input: PersonaUpdate): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      UPDATE "persona"
      SET
        "displayName" = $1,
        "personality" = $2,
        "usesCodingHarness" = $3,
        "lifecycleStatus" = $4,
        "routingPriority" = $5
      WHERE "id" = $6
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.personality, input.usesCodingHarness, input.lifecycleStatus, input.routingPriority, personaId],
  );

  return result.rows[0];
};

export const queryPersonaAssignToLoop = async (loopId: string, personaId: string): Promise<void> => {
  await getPool().query(`INSERT INTO "loopPersona" ("loop", "persona") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [loopId, personaId]);
};

export const queryPersonaDelete = async (personaId: string, loopId: string): Promise<boolean> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const unlinkResult = await client.query(
      `
        DELETE FROM "loopPersona"
        WHERE "persona" = $1 AND "loop" = $2
      `,
      [personaId, loopId],
    );

    if (!unlinkResult.rowCount) {
      await client.query(`ROLLBACK`);
      return false;
    }

    // Remove the persona record itself if it is not a default and has no remaining loop assignments
    await client.query(
      `
        DELETE FROM "persona"
        WHERE "id" = $1
          AND "isDefault" = FALSE
          AND NOT EXISTS (SELECT 1 FROM "loopPersona" WHERE "persona" = $1)
      `,
      [personaId],
    );

    await client.query(`COMMIT`);
    return true;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

