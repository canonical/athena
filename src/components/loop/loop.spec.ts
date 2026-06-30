import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`loop routes require authentication`, async ({ request }) => {
  const [listResponse, createResponse] = await Promise.all([
    request.get(`/api/loop-list`),
    request.post(`/api/loop-list`, {
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

  const listResponse = await page.request.get(`http://athena.localhost/api/loop-list`);
  expect(listResponse.status()).toBe(200);

  const loops = (await listResponse.json()) as Array<{ id: string; name: string }>;
  expect(loops.map((loop) => loop.id)).toEqual(expect.arrayContaining([created.id, another.id]));

  const getResponse = await page.request.get(`http://athena.localhost/api/loop/${created.id}`);
  expect(getResponse.status()).toBe(200);
  await expect(getResponse.json()).resolves.toMatchObject({
    id: created.id,
    name: `Platform loop`,
    description: `Platform team work`,
  });

  const updateResponse = await page.request.put(`http://athena.localhost/api/loop/${created.id}`, {
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

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loop/${created.id}`);
  expect(deleteResponse.status()).toBe(204);

  const deletedGetResponse = await page.request.get(`http://athena.localhost/api/loop/${created.id}`);
  expect(deletedGetResponse.status()).toBe(404);
  await expect(deletedGetResponse.json()).resolves.toEqual({ error: `Loop not found.` });
});

test(`loops reject missing names`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop-list`, {
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

test(`loop list allows navigating to loop detail page`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop-list`);

  await page.getByLabel(`Loop name`).fill(`Navigation test loop`);
  await page.getByLabel(`Loop description`).fill(`Loop for navigation test`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`Navigation test loop is ready to receive events.`)).toBeVisible();

  await page.getByRole(`link`, { name: `Navigation test loop` }).click();

  await expect(page.getByRole(`heading`, { name: `Navigation test loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Details` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toBeVisible();
});

test(`loop detail page tabs are deep-linkable`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Deep link tab loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=personas`);

  await expect(page.getByRole(`heading`, { name: `Deep link tab loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();
});

test(`loop detail shows paused notification when no routing persona is active`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Paused routing loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`);
  const personas = (await listResponse.json()) as Array<{ id: string; isRouting: boolean; displayName: string; personality: string; lifecycleStatus: string }>;
  const routingPersona = personas.find((p) => p.isRouting);
  expect(routingPersona).toBeDefined();

  if (!routingPersona) {
    throw new Error(`Routing persona not found.`);
  }

  // Archive the routing persona so no active routing persona remains (default personas cannot be deleted)
  const archiveResponse = await page.request.put(`http://athena.localhost/api/persona/${routingPersona.id}`, {
    data: {
      displayName: routingPersona.displayName,
      personality: routingPersona.personality,
      usesCodingHarness: false,
      lifecycleStatus: `archived`,
    },
  });
  expect(archiveResponse.status()).toBe(200);

  // Navigate to personas tab so the routing count is computed and the paused banner appears
  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=personas`);

  await expect(page.getByRole(`heading`, { name: `Paused routing loop` })).toBeVisible();
  await expect(page.getByText(`Loop is paused`)).toBeVisible();
  await expect(page.getByText(/no active routing persona/i)).toBeVisible();

  // Restore the routing persona to active so subsequent tests are not affected
  await page.request.put(`http://athena.localhost/api/persona/${routingPersona.id}`, {
    data: {
      displayName: routingPersona.displayName,
      personality: routingPersona.personality,
      usesCodingHarness: false,
      lifecycleStatus: `active`,
    },
  });
});
