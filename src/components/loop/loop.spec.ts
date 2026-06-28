import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`loop routes require authentication`, async ({ request }) => {
  const [listResponse, createResponse] = await Promise.all([
    request.get(`/api/loops`),
    request.post(`/api/loops`, {
      data: {
        name: `Unauthenticated loop`,
        description: `Should not be created`,
      },
    }),
  ]);

  expect(listResponse.status()).toBe(401);
  expect(createResponse.status()).toBe(401);
});

test(`loops support create read update and delete through the API`, async ({ page }) => {
  await authenticate(page);

  const created = await createLoop(page, `Platform loop`, `Platform team work`);
  const another = await createLoop(page, `Operations loop`, `Operations team work`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops`);
  expect(listResponse.status()).toBe(200);

  const loops = (await listResponse.json()) as Array<{ id: string; name: string }>;
  expect(loops.map((loop) => loop.id)).toEqual(expect.arrayContaining([created.id, another.id]));

  const getResponse = await page.request.get(`http://athena.localhost/api/loops/${created.id}`);
  expect(getResponse.status()).toBe(200);
  await expect(getResponse.json()).resolves.toMatchObject({
    id: created.id,
    name: `Platform loop`,
    description: `Platform team work`,
  });

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${created.id}`, {
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

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loops/${created.id}`);
  expect(deleteResponse.status()).toBe(204);

  const deletedGetResponse = await page.request.get(`http://athena.localhost/api/loops/${created.id}`);
  expect(deletedGetResponse.status()).toBe(404);
  await expect(deletedGetResponse.json()).resolves.toEqual({ error: `Loop not found.` });
});

test(`loops reject missing names`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loops`, {
    data: {
      name: `   `,
      description: `Blank name`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `name is required.` });
});

test(`loops page supports create update and delete`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop-list`);

  await expect(page.getByRole(`heading`, { name: `Loops` })).toBeVisible();
  await page.getByLabel(`Loop name`).fill(`UI loop`);
  await page.getByLabel(`Loop description`).fill(`Loop created through the UI`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`UI loop is ready to receive events.`)).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Edit UI loop` }).click();
  await page.getByLabel(`Loop name`).nth(1).fill(`UI loop updated`);
  await page.getByLabel(`Loop description`).nth(1).fill(`Updated through the UI`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`UI loop updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Delete UI loop updated` }).click();

  await expect(page.getByText(`UI loop updated has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true })).toHaveCount(0);
});
