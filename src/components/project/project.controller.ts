import { getPool } from "@components/postgres/postgres.js";
import type { Project, ProjectInsert, ProjectUpdate } from "./project.schema.js";

const projectColumns = `"id", "name", "description", "createdAt", "updatedAt"`;
const projectSelectColumns = `p."id", p."name", p."description", p."createdAt", p."updatedAt"`;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const validateProjectInput = (value: unknown): ProjectInsert | ProjectUpdate => {
  if (!isRecord(value)) {
    throw new ProjectValidationError(`Project request body must be an object.`);
  }

  const name = normalizeString(value.name);

  if (!name) {
    throw new ProjectValidationError(`name is required.`);
  }

  return {
    name,
    description: normalizeString(value.description),
  };
};

export class ProjectValidationError extends Error {}
export class ProjectNotFoundError extends Error {}

export const validateCreateProjectRequest = (value: unknown): ProjectInsert => validateProjectInput(value);
export const validateUpdateProjectRequest = (value: unknown): ProjectUpdate => validateProjectInput(value);

export const getProjectForUser = async (projectId: string, userId: string): Promise<Project | undefined> => {
  const result = await getPool().query<Project>(
    `
      SELECT ${projectSelectColumns}
      FROM "project" p
      JOIN "projectUser" pu ON pu."project" = p."id"
      WHERE p."id" = $1
        AND pu."user" = $2
    `,
    [projectId, userId],
  );

  return result.rows[0];
};

export const listProjects = async (userId: string): Promise<Project[]> => {
  const result = await getPool().query<Project>(
    `
      SELECT ${projectSelectColumns}
      FROM "project" p
      JOIN "projectUser" pu ON pu."project" = p."id"
      WHERE pu."user" = $1
      ORDER BY p."updatedAt" DESC, p."createdAt" DESC
    `,
    [userId],
  );

  return result.rows;
};

export const getProject = async (projectId: string, userId: string): Promise<Project> => {
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    throw new ProjectNotFoundError(`Project not found.`);
  }

  return project;
};

export const createProject = async (input: ProjectInsert, userId: string): Promise<Project> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const result = await client.query<Project>(
      `
        INSERT INTO "project" ("name", "description")
        VALUES ($1, $2)
        RETURNING ${projectColumns}
      `,
      [input.name, input.description ?? null],
    );

    const project = result.rows[0];

    if (!project) {
      throw new Error(`Project was not created.`);
    }

    await client.query(`INSERT INTO "projectUser" ("project", "user") VALUES ($1, $2)`, [project.id, userId]);
    await client.query(`COMMIT`);

    return project;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const updateProject = async (projectId: string, input: ProjectUpdate, userId: string): Promise<Project> => {
  const result = await getPool().query<Project>(
    `
      UPDATE "project" AS p
      SET
        "name" = $1,
        "description" = $2
      FROM "projectUser" AS pu
      WHERE p."id" = $3
        AND pu."project" = p."id"
        AND pu."user" = $4
      RETURNING p."id", p."name", p."description", p."createdAt", p."updatedAt"
    `,
    [input.name, input.description ?? null, projectId, userId],
  );

  const project = result.rows[0];

  if (!project) {
    throw new ProjectNotFoundError(`Project not found.`);
  }

  return project;
};

export const deleteProject = async (projectId: string, userId: string): Promise<void> => {
  const result = await getPool().query(
    `
      DELETE FROM "project" AS p
      USING "projectUser" AS pu
      WHERE p."id" = $1
        AND pu."project" = p."id"
        AND pu."user" = $2
    `,
    [projectId, userId],
  );

  if (!result.rowCount) {
    throw new ProjectNotFoundError(`Project not found.`);
  }
};
