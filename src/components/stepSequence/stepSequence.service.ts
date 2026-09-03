import { getPool, query } from "@components/postgres/postgres.js";
import type { StepDefinition, StepDefinitionWritable, StepSequence, StepSequenceWritable, TaskSourceStepSequence, TaskSourceStepSequenceWritable } from "./stepSequence.schema.js";

const stepSequenceColumns = `"id", "loop", "name", "isDefault", "createdAt", "updatedAt"`;
const stepDefinitionColumns = `"id", "stepSequence", "name", "sequenceOrder", "instructions", "personaSelectionPolicy", "persona", "modelSelectionPolicy", "modelProvider", "model", "createdAt", "updatedAt"`;
const taskSourceStepSequenceColumns = `"id", "loop", "taskSource", "stepSequence", "createdAt", "updatedAt"`;

export const queryStepSequenceList = async (loopId: string): Promise<StepSequence[]> => {
  const result = await query<StepSequence>(
    `
      SELECT ${stepSequenceColumns}
      FROM "stepSequence"
      WHERE "loop" = $1
      ORDER BY "isDefault" DESC, "createdAt" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryStepSequenceById = async (stepSequenceId: string, loopId: string): Promise<StepSequence | undefined> => {
  const result = await query<StepSequence>(
    `
      SELECT ${stepSequenceColumns}
      FROM "stepSequence"
      WHERE "id" = $1 AND "loop" = $2
    `,
    [stepSequenceId, loopId],
  );

  return result.rows[0];
};

export const queryStepSequenceByName = async (loopId: string, name: string): Promise<StepSequence | undefined> => {
  const result = await query<StepSequence>(
    `
      SELECT ${stepSequenceColumns}
      FROM "stepSequence"
      WHERE "loop" = $1 AND "name" = $2
    `,
    [loopId, name],
  );

  return result.rows[0];
};

export const queryStepSequenceDefault = async (loopId: string): Promise<StepSequence | undefined> => {
  const result = await query<StepSequence>(
    `
      SELECT ${stepSequenceColumns}
      FROM "stepSequence"
      WHERE "loop" = $1 AND "isDefault" = TRUE
    `,
    [loopId],
  );

  return result.rows[0];
};

export const queryStepSequenceCreate = async (loopId: string, input: StepSequenceWritable): Promise<StepSequence> => {
  const result = await query<StepSequence>(
    `
      INSERT INTO "stepSequence" ("loop", "name", "isDefault")
      VALUES ($1, $2, $3)
      RETURNING ${stepSequenceColumns}
    `,
    [loopId, input.name, input.isDefault],
  );

  const [stepSequence] = result.rows;

  if (!stepSequence) {
    throw new Error(`Step sequence was not created.`);
  }

  return stepSequence;
};

export const queryStepSequenceUpdate = async (stepSequenceId: string, loopId: string, input: StepSequenceWritable): Promise<StepSequence | undefined> => {
  const result = await query<StepSequence>(
    `
      UPDATE "stepSequence"
      SET
        "name" = $1,
        "isDefault" = $2
      WHERE "id" = $3 AND "loop" = $4
      RETURNING ${stepSequenceColumns}
    `,
    [input.name, input.isDefault, stepSequenceId, loopId],
  );

  return result.rows[0];
};

export const queryStepSequenceClearDefault = async (loopId: string, excludeStepSequenceId?: string): Promise<void> => {
  await query(
    `
      UPDATE "stepSequence"
      SET "isDefault" = FALSE
      WHERE "loop" = $1 AND "isDefault" = TRUE AND "id" IS DISTINCT FROM $2
    `,
    [loopId, excludeStepSequenceId ?? null],
  );
};

export const queryStepSequenceDelete = async (stepSequenceId: string, loopId: string): Promise<boolean> => {
  const result = await query(
    `
      DELETE FROM "stepSequence"
      WHERE "id" = $1 AND "loop" = $2
    `,
    [stepSequenceId, loopId],
  );

  return Boolean(result.rowCount);
};

export const queryStepDefinitionList = async (stepSequenceId: string): Promise<StepDefinition[]> => {
  const result = await query<StepDefinition>(
    `
      SELECT ${stepDefinitionColumns}
      FROM "stepDefinition"
      WHERE "stepSequence" = $1
      ORDER BY "sequenceOrder" ASC
    `,
    [stepSequenceId],
  );

  return result.rows;
};

export const queryStepDefinitionById = async (stepDefinitionId: string, stepSequenceId: string): Promise<StepDefinition | undefined> => {
  const result = await query<StepDefinition>(
    `
      SELECT ${stepDefinitionColumns}
      FROM "stepDefinition"
      WHERE "id" = $1 AND "stepSequence" = $2
    `,
    [stepDefinitionId, stepSequenceId],
  );

  return result.rows[0];
};

export const queryStepDefinitionByName = async (stepSequenceId: string, name: string): Promise<StepDefinition | undefined> => {
  const result = await query<StepDefinition>(
    `
      SELECT ${stepDefinitionColumns}
      FROM "stepDefinition"
      WHERE "stepSequence" = $1 AND "name" = $2
    `,
    [stepSequenceId, name],
  );

  return result.rows[0];
};

export const queryStepDefinitionByOrder = async (stepSequenceId: string, sequenceOrder: number): Promise<StepDefinition | undefined> => {
  const result = await query<StepDefinition>(
    `
      SELECT ${stepDefinitionColumns}
      FROM "stepDefinition"
      WHERE "stepSequence" = $1 AND "sequenceOrder" = $2
    `,
    [stepSequenceId, sequenceOrder],
  );

  return result.rows[0];
};

export const queryStepDefinitionCreate = async (stepSequenceId: string, input: StepDefinitionWritable): Promise<StepDefinition> => {
  const result = await query<StepDefinition>(
    `
      INSERT INTO "stepDefinition" (
        "stepSequence", "name", "sequenceOrder", "instructions",
        "personaSelectionPolicy", "persona", "modelSelectionPolicy", "modelProvider", "model"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${stepDefinitionColumns}
    `,
    [stepSequenceId, input.name, input.sequenceOrder, input.instructions, input.personaSelectionPolicy, input.persona, input.modelSelectionPolicy, input.modelProvider, input.model],
  );

  const [stepDefinition] = result.rows;

  if (!stepDefinition) {
    throw new Error(`Step definition was not created.`);
  }

  return stepDefinition;
};

export const queryStepDefinitionUpdate = async (stepDefinitionId: string, stepSequenceId: string, input: StepDefinitionWritable): Promise<StepDefinition | undefined> => {
  const result = await query<StepDefinition>(
    `
      UPDATE "stepDefinition"
      SET
        "name" = $1,
        "sequenceOrder" = $2,
        "instructions" = $3,
        "personaSelectionPolicy" = $4,
        "persona" = $5,
        "modelSelectionPolicy" = $6,
        "modelProvider" = $7,
        "model" = $8
      WHERE "id" = $9 AND "stepSequence" = $10
      RETURNING ${stepDefinitionColumns}
    `,
    [input.name, input.sequenceOrder, input.instructions, input.personaSelectionPolicy, input.persona, input.modelSelectionPolicy, input.modelProvider, input.model, stepDefinitionId, stepSequenceId],
  );

  return result.rows[0];
};

/**
 * Reassigns sequenceOrder for every step definition in a sequence based on
 * the given ordered list of ids, so a full reorder never trips the
 * (stepSequence, sequenceOrder) unique constraint on intermediate states.
 */
export const queryStepDefinitionReorder = async (stepSequenceId: string, orderedStepDefinitionIds: string[]): Promise<StepDefinition[]> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    // Move every row to a negative, guaranteed-unique order first so the
    // final pass never collides with an existing value.
    await client.query(`UPDATE "stepDefinition" SET "sequenceOrder" = -"sequenceOrder" - 1 WHERE "stepSequence" = $1`, [stepSequenceId]);

    for (const [index, stepDefinitionId] of orderedStepDefinitionIds.entries()) {
      await client.query(`UPDATE "stepDefinition" SET "sequenceOrder" = $1 WHERE "id" = $2 AND "stepSequence" = $3`, [index + 1, stepDefinitionId, stepSequenceId]);
    }

    const result = await client.query<StepDefinition>(
      `
        SELECT ${stepDefinitionColumns}
        FROM "stepDefinition"
        WHERE "stepSequence" = $1
        ORDER BY "sequenceOrder" ASC
      `,
      [stepSequenceId],
    );

    await client.query(`COMMIT`);

    return result.rows;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryStepDefinitionDelete = async (stepDefinitionId: string, stepSequenceId: string): Promise<boolean> => {
  const result = await query(
    `
      DELETE FROM "stepDefinition"
      WHERE "id" = $1 AND "stepSequence" = $2
    `,
    [stepDefinitionId, stepSequenceId],
  );

  return Boolean(result.rowCount);
};

export const queryPersonaAssignedToLoop = async (personaId: string, loopId: string): Promise<boolean> => {
  const result = await query(
    `
      SELECT 1
      FROM "loopPersona"
      WHERE "persona" = $1 AND "loop" = $2
    `,
    [personaId, loopId],
  );

  return Boolean(result.rowCount);
};

export const queryProviderAssignedToLoop = async (providerId: string, loopId: string): Promise<boolean> => {
  const result = await query(
    `
      SELECT 1
      FROM "loopProvider"
      WHERE "provider" = $1 AND "loop" = $2
    `,
    [providerId, loopId],
  );

  return Boolean(result.rowCount);
};

export const queryTaskSourceStepSequenceList = async (loopId: string): Promise<TaskSourceStepSequence[]> => {
  const result = await query<TaskSourceStepSequence>(
    `
      SELECT ${taskSourceStepSequenceColumns}
      FROM "taskSourceStepSequence"
      WHERE "loop" = $1
      ORDER BY "taskSource" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryTaskSourceStepSequenceByTaskSource = async (loopId: string, taskSource: string): Promise<TaskSourceStepSequence | undefined> => {
  const result = await query<TaskSourceStepSequence>(
    `
      SELECT ${taskSourceStepSequenceColumns}
      FROM "taskSourceStepSequence"
      WHERE "loop" = $1 AND "taskSource" = $2
    `,
    [loopId, taskSource],
  );

  return result.rows[0];
};

export const queryTaskSourceStepSequenceUpsert = async (loopId: string, input: TaskSourceStepSequenceWritable): Promise<TaskSourceStepSequence> => {
  const result = await query<TaskSourceStepSequence>(
    `
      INSERT INTO "taskSourceStepSequence" ("loop", "taskSource", "stepSequence")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "taskSource")
      DO UPDATE SET "stepSequence" = EXCLUDED."stepSequence"
      RETURNING ${taskSourceStepSequenceColumns}
    `,
    [loopId, input.taskSource, input.stepSequence],
  );

  const [mapping] = result.rows;

  if (!mapping) {
    throw new Error(`Task source mapping was not created.`);
  }

  return mapping;
};

export const queryTaskSourceStepSequenceDelete = async (loopId: string, taskSource: string): Promise<boolean> => {
  const result = await query(
    `
      DELETE FROM "taskSourceStepSequence"
      WHERE "loop" = $1 AND "taskSource" = $2
    `,
    [loopId, taskSource],
  );

  return Boolean(result.rowCount);
};
