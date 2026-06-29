import { getPool } from "@components/postgres/postgres.js";
import type { Persona, PersonaInsert, PersonaUpdate } from "./persona.schema.js";

const personaColumns = `p."id", p."displayName", p."personality", p."usesCodingHarness", p."isRouting", p."isDefault", p."owner", p."lifecycleStatus", p."createdAt", p."updatedAt"`;

const personaColumnsUnqualified = `"id", "displayName", "personality", "usesCodingHarness", "isRouting", "isDefault", "owner", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryLoopPersonaList = async (loopId: string): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumns}
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE lp."loop" = $1
      ORDER BY p."isRouting" DESC, p."createdAt" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryPersonaList = async (): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumnsUnqualified}
      FROM "persona"
      ORDER BY "isRouting" DESC, "displayName" ASC
    `,
  );

  return result.rows;
};

export const queryLoopPersonaById = async (personaId: string, loopId: string): Promise<Persona | undefined> => {
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

export const queryPersonaById = async (personaId: string): Promise<Persona | undefined> => {
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

export const queryPersonaActiveCount = async (loopId: string): Promise<{ total: number; withCodingHarness: number; routing: number }> => {
  const result = await getPool().query<{ total: string; withCodingHarness: string; routing: string }>(
    `
      SELECT
        COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE p."usesCodingHarness" = TRUE) AS "withCodingHarness",
        COUNT(*) FILTER (WHERE p."isRouting" = TRUE) AS "routing"
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE lp."loop" = $1 AND p."lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  const row = result.rows[0];

  if (!row) {
    return { total: 0, withCodingHarness: 0, routing: 0 };
  }

  return {
    total: Number(row.total),
    withCodingHarness: Number(row.withCodingHarness),
    routing: Number(row.routing),
  };
};

export const queryPersonaCreate = async (loopId: string, input: PersonaInsert, isRouting: boolean, ownerId: string | null): Promise<Persona> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const result = await client.query<Persona>(
      `
        INSERT INTO "persona" ("displayName", "personality", "usesCodingHarness", "isRouting", "owner", "lifecycleStatus")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${personaColumnsUnqualified}
      `,
      [input.displayName, input.personality, input.usesCodingHarness, isRouting, ownerId, input.lifecycleStatus],
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

export const queryPersonaCreateGlobal = async (input: PersonaInsert, isRouting: boolean, ownerId: string | null): Promise<Persona> => {
  const result = await getPool().query<Persona>(
    `
      INSERT INTO "persona" ("displayName", "personality", "usesCodingHarness", "isRouting", "owner", "lifecycleStatus")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.personality, input.usesCodingHarness, isRouting, ownerId, input.lifecycleStatus],
  );

  const [persona] = result.rows;

  if (!persona) {
    throw new Error(`Persona was not created.`);
  }

  return persona;
};

export const queryPersonaUpdate = async (personaId: string, input: PersonaUpdate): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      UPDATE "persona"
      SET
        "displayName" = $1,
        "personality" = $2,
        "usesCodingHarness" = $3,
        "lifecycleStatus" = $4
      WHERE "id" = $5
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.personality, input.usesCodingHarness, input.lifecycleStatus, personaId],
  );

  return result.rows[0];
};

export const queryPersonaDefaultList = async (): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(`SELECT ${personaColumnsUnqualified} FROM "persona" WHERE "isDefault" = TRUE ORDER BY "displayName" ASC`);

  return result.rows;
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
