import { defaultEmPersonality } from "@components/persona/persona.schema.js";
import { queryPersonaSeedEM } from "@components/persona/persona.service.js";
import { getPool } from "@components/postgres/postgres.js";
import type { Loop, LoopInsert, LoopUpdate } from "./loop.schema.js";

const emPersonality = defaultEmPersonality;

const loopColumns = `"id", "name", "description", "createdAt", "updatedAt"`;
const loopSelectColumns = `l."id", l."name", l."description", l."createdAt", l."updatedAt"`;

export const queryLoopForUser = async (loopId: string, userId: string): Promise<Loop | undefined> => {
  const result = await getPool().query<Loop>(
    `
      SELECT ${loopSelectColumns}
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE l."id" = $1
        AND lu."user" = $2
    `,
    [loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopList = async (userId: string): Promise<Loop[]> => {
  const result = await getPool().query<Loop>(
    `
      SELECT ${loopSelectColumns}
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE lu."user" = $1
      ORDER BY l."updatedAt" DESC, l."createdAt" DESC
    `,
    [userId],
  );

  return result.rows;
};

export const queryLoopCreate = async (input: LoopInsert, userId: string): Promise<Loop> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const result = await client.query<Loop>(
      `
        INSERT INTO "loop" ("name", "description")
        VALUES ($1, $2)
        RETURNING ${loopColumns}
      `,
      [input.name, input.description ?? null],
    );

    const loop = result.rows[0];

    if (!loop) {
      throw new Error(`Loop was not created.`);
    }

    await client.query(`INSERT INTO "loopUser" ("loop", "user", "isAdmin") VALUES ($1, $2, TRUE)`, [loop.id, userId]);
    await queryPersonaSeedEM(loop.id, emPersonality, client);
    await client.query(`COMMIT`);

    return loop;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryLoopUpdate = async (loopId: string, input: LoopUpdate, userId: string): Promise<Loop | undefined> => {
  const result = await getPool().query<Loop>(
    `
      UPDATE "loop" AS l
      SET
        "name" = $1,
        "description" = $2
      FROM "loopUser" AS lu
      WHERE l."id" = $3
        AND lu."loop" = l."id"
        AND lu."user" = $4
       AND lu."isAdmin" = TRUE
      RETURNING l."id", l."name", l."description", l."createdAt", l."updatedAt"
    `,
    [input.name, input.description ?? null, loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopDelete = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "loop" AS l
      USING "loopUser" AS lu
      WHERE l."id" = $1
        AND lu."loop" = l."id"
        AND lu."user" = $2
        AND lu."isAdmin" = TRUE
    `,
    [loopId, userId],
  );

  return Boolean(result.rowCount);
};
