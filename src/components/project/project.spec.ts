import { authenticate, expect, test } from "../../../testing/playwright/index.js";

const createProject = async (page: Parameters<typeof authenticate>[0], name: string, description = `${name} description`) => {
  const response = await page.request.post(`http://athena.localhost/api/projects`, {
    data: {
      name,
      description,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string; description: string | null };
};

test(`project routes require authentication`, async ({ request }) => {
  const [listResponse, createResponse] = await Promise.all([
    request.get(`/api/projects`),
    request.post(`/api/projects`, {
      data: {
        name: `Unauthenticated project`,
        description: `Should not be created`,
      },
    }),
  ]);

  expect(listResponse.status()).toBe(401);
  expect(createResponse.status()).toBe(401);
});

test(`projects support create read update and delete through the API`, async ({ page }) => {
  await authenticate(page);

  const created = await createProject(page, `Platform project`, `Platform team work`);
  const another = await createProject(page, `Operations project`, `Operations team work`);

  const listResponse = await page.request.get(`http://athena.localhost/api/projects`);
  expect(listResponse.status()).toBe(200);

  const projects = (await listResponse.json()) as Array<{ id: string; name: string }>;
  expect(projects.map((project) => project.id)).toEqual(expect.arrayContaining([created.id, another.id]));

  const getResponse = await page.request.get(`http://athena.localhost/api/projects/${created.id}`);
  expect(getResponse.status()).toBe(200);
  await expect(getResponse.json()).resolves.toMatchObject({
    id: created.id,
    name: `Platform project`,
    description: `Platform team work`,
  });

  const updateResponse = await page.request.put(`http://athena.localhost/api/projects/${created.id}`, {
    data: {
      name: `Platform delivery`,
      description: `Updated description`,
    },
  });
  expect(updateResponse.status()).toBe(200);
  await expect(updateResponse.json()).resolves.toMatchObject({
    id: created.id,
    name: `Platform delivery`,
    description: `Updated description`,
  });

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/projects/${created.id}`);
  expect(deleteResponse.status()).toBe(204);

  const deletedGetResponse = await page.request.get(`http://athena.localhost/api/projects/${created.id}`);
  expect(deletedGetResponse.status()).toBe(404);
  await expect(deletedGetResponse.json()).resolves.toEqual({ error: `Project not found.` });
});

test(`projects reject missing names`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/projects`, {
    data: {
      name: `   `,
      description: `Blank name`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `name is required.` });
});

test(`projects page supports create update and delete`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/projects`);

  await expect(page.getByRole(`heading`, { name: `Projects` })).toBeVisible();
  await page.getByLabel(`Project name`).fill(`UI project`);
  await page.getByLabel(`Project description`).fill(`Project created through the UI`);
  await page.getByRole(`button`, { name: `Create project` }).click();

  await expect(page.getByText(`UI project is ready to use.`)).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI project`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Edit UI project` }).click();
  await page.getByLabel(`Project name`).nth(1).fill(`UI project updated`);
  await page.getByLabel(`Project description`).nth(1).fill(`Updated through the UI`);
  await page.getByRole(`button`, { name: `Save project` }).click();

  await expect(page.getByText(`UI project updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI project updated`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Delete UI project updated` }).click();

  await expect(page.getByText(`UI project updated has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI project updated`, exact: true })).toHaveCount(0);
});
