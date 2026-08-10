import { getPool } from "@components/postgres/postgres.js";
import type { Persona, PersonaWritable } from "./persona.schema.js";

const personaColumns = `p."id", p."displayName", p."role", p."personality", p."isRouting", p."isDefault", p."owner", p."lifecycleStatus", p."createdAt", p."updatedAt"`;

const personaColumnsUnqualified = `"id", "displayName", "role", "personality", "isRouting", "isDefault", "owner", "lifecycleStatus", "createdAt", "updatedAt"`;

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

export const queryPersonaList = async (ownerId: string): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumnsUnqualified}
      FROM "persona"
      WHERE "owner" = $1
      ORDER BY "isRouting" DESC, "displayName" ASC
    `,
    [ownerId],
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

export const queryPersonaForUser = async (personaId: string, userId: string): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      SELECT ${personaColumnsUnqualified}
      FROM "persona"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [personaId, userId],
  );

  return result.rows[0];
};

export const queryPersonaActiveCount = async (loopId: string): Promise<{ total: number; routing: number }> => {
  const result = await getPool().query<{ total: string; routing: string }>(
    `
      SELECT
        COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE p."isRouting" = TRUE) AS "routing"
      FROM "persona" p
      JOIN "loopPersona" lp ON lp."persona" = p."id"
      WHERE lp."loop" = $1 AND p."lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  const row = result.rows[0];

  if (!row) {
    return { total: 0, routing: 0 };
  }

  return {
    total: Number(row.total),
    routing: Number(row.routing),
  };
};

export const queryPersonaCreate = async (input: PersonaWritable, isRouting: boolean, ownerId: string | null): Promise<Persona> => {
  const result = await getPool().query<Persona>(
    `
      INSERT INTO "persona" ("displayName", "role", "personality", "isRouting", "owner", "lifecycleStatus")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.role, input.personality, isRouting, ownerId, input.lifecycleStatus],
  );

  const [persona] = result.rows;

  if (!persona) {
    throw new Error(`Persona was not created.`);
  }

  return persona;
};

export const queryPersonaUpdate = async (personaId: string, input: PersonaWritable): Promise<Persona | undefined> => {
  const result = await getPool().query<Persona>(
    `
      UPDATE "persona"
      SET
        "displayName" = $1,
        "role" = $2,
        "personality" = $3,
        "lifecycleStatus" = $4
      WHERE "id" = $5
      RETURNING ${personaColumnsUnqualified}
    `,
    [input.displayName, input.role, input.personality, input.lifecycleStatus, personaId],
  );

  return result.rows[0];
};

export const queryPersonaDelete = async (personaId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "persona"
      WHERE "id" = $1 AND "owner" = $2
    `,
    [personaId, ownerId],
  );

  return Boolean(result.rowCount);
};

export const queryPersonaDefaultList = async (): Promise<Persona[]> => {
  const result = await getPool().query<Persona>(`SELECT ${personaColumnsUnqualified} FROM "persona" WHERE "isDefault" = TRUE ORDER BY "displayName" ASC`);

  return result.rows;
};

export const queryPersonaAssignToLoop = async (loopId: string, personaId: string): Promise<void> => {
  await getPool().query(`INSERT INTO "loopPersona" ("loop", "persona") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [loopId, personaId]);
};

export const queryLoopMembership = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await getPool().query(`SELECT 1 FROM "loopUser" WHERE "loop" = $1 AND "user" = $2`, [loopId, userId]);

  return Boolean(result.rowCount);
};

export const queryPersonaUnassign = async (personaId: string, loopId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "loopPersona"
      WHERE "persona" = $1 AND "loop" = $2
    `,
    [personaId, loopId],
  );

  return Boolean(result.rowCount);
};
