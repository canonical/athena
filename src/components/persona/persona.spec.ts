import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`persona routes require authentication`, async ({ request }) => {
  const [catalogResponse, listResponse] = await Promise.all([request.get(`/api/persona/catalog`), request.get(`/api/loop/00000000-0000-7000-8000-000000000001/persona-list`)]);

  expect(catalogResponse.status()).toBe(401);
  expect(listResponse.status()).toBe(401);
});

test(`persona catalog returns reference personas`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.get(`http://athena.localhost/api/persona/catalog`);
  expect(response.status()).toBe(200);

  const catalog = (await response.json()) as Array<{ id: string; displayName: string; usesCodingHarness: boolean; isRouting: boolean; isDefault: boolean }>;
  expect(catalog.length).toBeGreaterThan(0);

  for (const persona of catalog) {
    expect(persona.isDefault).toBe(true);
  }

  const routing = catalog.find((p) => p.isRouting);
  expect(routing).toBeDefined();
  expect(routing?.usesCodingHarness).toBe(false);

  const harness = catalog.find((p) => p.usesCodingHarness);
  expect(harness).toBeDefined();
  expect(harness?.isRouting).toBe(false);
});

test(`loop creation seeds an EM persona automatically`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona seed loop`);

  const response = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`);
  expect(response.status()).toBe(200);

  const personas = (await response.json()) as Array<{ isRouting: boolean; displayName: string; lifecycleStatus: string }>;
  const emPersonas = personas.filter((p) => p.isRouting);
  expect(emPersonas.length).toBe(1);
  expect(emPersonas[0]?.lifecycleStatus).toBe(`active`);
});

test(`personas support create read update and delete through the API`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona CRUD loop`);

  const createResponse = await page.request.post(`http://athena.localhost/api/loop/${loop.id}/persona-list`, {
    data: {
      displayName: `IC Persona`,
      personality: `You are a senior IC.`,
      usesCodingHarness: true,
      lifecycleStatus: `active`,
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as { id: string; displayName: string; usesCodingHarness: boolean; isRouting: boolean };
  expect(created.displayName).toBe(`IC Persona`);
  expect(created.usesCodingHarness).toBe(true);
  expect(created.isRouting).toBe(false);

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`);
  expect(listResponse.status()).toBe(200);
  const personas = (await listResponse.json()) as Array<{ id: string }>;
  expect(personas.map((p) => p.id)).toContain(created.id);

  const updateResponse = await page.request.put(`http://athena.localhost/api/persona/${created.id}`, {
    data: {
      displayName: `IC Persona Updated`,
      personality: `You are a senior IC, updated.`,
      usesCodingHarness: true,
      lifecycleStatus: `active`,
    },
  });
  expect(updateResponse.status()).toBe(200);
  await expect(updateResponse.json()).resolves.toMatchObject({
    id: created.id,
    displayName: `IC Persona Updated`,
  });

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loop/${loop.id}/persona/${created.id}`);
  expect(deleteResponse.status()).toBe(204);
});

test(`routing persona cannot be deleted`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM delete guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`);
  const personas = (await listResponse.json()) as Array<{ id: string; isRouting: boolean }>;
  const routingPersona = personas.find((p) => p.isRouting);
  expect(routingPersona).toBeDefined();

  if (!routingPersona) {
    throw new Error(`Routing persona not found.`);
  }

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loop/${loop.id}/persona/${routingPersona.id}`);
  expect(deleteResponse.status()).toBe(400);
  await expect(deleteResponse.json()).resolves.toEqual({ error: `Default personas cannot be deleted.` });
});

test(`routing persona cannot be updated to use coding harness`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM harness guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`);
  const personas = (await listResponse.json()) as Array<{ id: string; isRouting: boolean; displayName: string; personality: string; lifecycleStatus: string }>;
  const routingPersona = personas.find((p) => p.isRouting);
  expect(routingPersona).toBeDefined();

  if (!routingPersona) {
    throw new Error(`Routing persona not found.`);
  }

  const updateResponse = await page.request.put(`http://athena.localhost/api/persona/${routingPersona.id}`, {
    data: {
      displayName: routingPersona.displayName,
      personality: routingPersona.personality,
      usesCodingHarness: true,
      lifecycleStatus: routingPersona.lifecycleStatus,
    },
  });
  expect(updateResponse.status()).toBe(400);
  await expect(updateResponse.json()).resolves.toEqual({ error: `A routing persona cannot use a coding harness.` });
});

test(`personas reject missing required fields`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona validation loop`);

  const response = await page.request.post(`http://athena.localhost/api/loop/${loop.id}/persona-list`, {
    data: {
      displayName: `   `,
      personality: `Valid personality`,
      usesCodingHarness: false,
      lifecycleStatus: `active`,
    },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `displayName is required.` });
});

test(`personas page shows global persona list and create form`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/persona-list`);

  await expect(page.locator(`h1`)).toHaveText(`Personas`);
  await expect(page.getByRole(`heading`, { name: `All personas` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Add persona` })).toBeVisible();
});

test(`persona list page supports creating a new persona globally`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/persona-list`);

  await page.getByLabel(`Display name`).fill(`Global IC`);
  await page.getByLabel(`Personality`).fill(`You are a global IC persona.`);
  await page.getByRole(`button`, { name: `Add persona` }).click();

  await expect(page.getByText(`Global IC has been created.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Global IC`, exact: true }).first()).toBeVisible();
});

test(`loop detail page shows Personas tab with assigned personas and assign form`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Loop detail personas loop`);
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  await expect(page.getByRole(`heading`, { name: `Loop detail personas loop` })).toBeVisible();
  const loopSections = page.getByRole(`navigation`, { name: `Loop sections` });
  await expect(loopSections).toBeVisible();
  await expect(loopSections.getByRole(`tablist`)).toBeVisible();
  await expect(loopSections.getByRole(`tab`, { name: `Details` })).toBeVisible();

  await loopSections.getByRole(`tab`, { name: `Personas` }).click();

  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  const personas = (await page.request.get(`http://athena.localhost/api/loop/${loop.id}/persona-list`)).json() as Promise<Array<{ displayName: string }>>;
  const personaList = await personas;
  expect(personaList.length).toBeGreaterThan(0);
});
