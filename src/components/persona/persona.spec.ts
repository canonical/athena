import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`persona routes require authentication`, async ({ request }) => {
  const [catalogResponse, listResponse] = await Promise.all([request.get(`/api/personas/catalog`), request.get(`/api/loops/00000000-0000-7000-8000-000000000001/personas`)]);

  expect(catalogResponse.status()).toBe(401);
  expect(listResponse.status()).toBe(401);
});

test(`persona catalog returns reference personas`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.get(`http://athena.localhost/api/personas/catalog`);
  expect(response.status()).toBe(200);

  const catalog = (await response.json()) as Array<{ role: string; displayName: string; usesCodingHarness: boolean; isDecisionMaker: boolean }>;
  expect(catalog.length).toBeGreaterThan(0);

  const roles = catalog.map((p) => p.role);
  expect(roles).toContain(`em`);
  expect(roles).toContain(`ic`);
  expect(roles).toContain(`cr`);
  expect(roles).toContain(`pm`);
  expect(roles).toContain(`qa`);
  expect(roles).toContain(`ux`);

  const em = catalog.find((p) => p.role === `em`);
  expect(em?.isDecisionMaker).toBe(true);
  expect(em?.usesCodingHarness).toBe(false);

  const ic = catalog.find((p) => p.role === `ic`);
  expect(ic?.usesCodingHarness).toBe(true);
  expect(ic?.isDecisionMaker).toBe(false);
});

test(`loop creation seeds an EM persona automatically`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona seed loop`);

  const response = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  expect(response.status()).toBe(200);

  const personas = (await response.json()) as Array<{ isDecisionMaker: boolean; displayName: string; lifecycleStatus: string }>;
  const emPersonas = personas.filter((p) => p.isDecisionMaker);
  expect(emPersonas.length).toBe(1);
  expect(emPersonas[0]?.lifecycleStatus).toBe(`active`);
});

test(`personas support create read update and delete through the API`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona CRUD loop`);

  const createResponse = await page.request.post(`http://athena.localhost/api/loops/${loop.id}/personas`, {
    data: {
      displayName: `IC Persona`,
      personality: `You are a senior IC.`,
      usesCodingHarness: true,
      lifecycleStatus: `active`,
      routingPriority: 1,
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as { id: string; displayName: string; usesCodingHarness: boolean; isDecisionMaker: boolean };
  expect(created.displayName).toBe(`IC Persona`);
  expect(created.usesCodingHarness).toBe(true);
  expect(created.isDecisionMaker).toBe(false);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  expect(listResponse.status()).toBe(200);
  const personas = (await listResponse.json()) as Array<{ id: string }>;
  expect(personas.map((p) => p.id)).toContain(created.id);

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${loop.id}/personas/${created.id}`, {
    data: {
      displayName: `IC Persona Updated`,
      personality: `You are a senior IC, updated.`,
      usesCodingHarness: true,
      lifecycleStatus: `active`,
      routingPriority: 2,
    },
  });
  expect(updateResponse.status()).toBe(200);
  await expect(updateResponse.json()).resolves.toMatchObject({
    id: created.id,
    displayName: `IC Persona Updated`,
    routingPriority: 2,
  });

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loops/${loop.id}/personas/${created.id}`);
  expect(deleteResponse.status()).toBe(204);
});

test(`decision maker persona cannot be deleted`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM delete guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  const personas = (await listResponse.json()) as Array<{ id: string; isDecisionMaker: boolean }>;
  const decisionMaker = personas.find((p) => p.isDecisionMaker);
  expect(decisionMaker).toBeDefined();

  if (!decisionMaker) {
    throw new Error(`Decision maker persona not found.`);
  }

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loops/${loop.id}/personas/${decisionMaker.id}`);
  expect(deleteResponse.status()).toBe(400);
  await expect(deleteResponse.json()).resolves.toEqual({ error: `Default personas cannot be deleted.` });
});

test(`decision maker persona cannot be updated to use coding harness`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM harness guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  const personas = (await listResponse.json()) as Array<{ id: string; isDecisionMaker: boolean; displayName: string; personality: string; lifecycleStatus: string; routingPriority: number }>;
  const decisionMaker = personas.find((p) => p.isDecisionMaker);
  expect(decisionMaker).toBeDefined();

  if (!decisionMaker) {
    throw new Error(`Decision maker persona not found.`);
  }

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${loop.id}/personas/${decisionMaker.id}`, {
    data: {
      displayName: decisionMaker.displayName,
      personality: decisionMaker.personality,
      usesCodingHarness: true,
      lifecycleStatus: decisionMaker.lifecycleStatus,
      routingPriority: decisionMaker.routingPriority,
    },
  });
  expect(updateResponse.status()).toBe(400);
  await expect(updateResponse.json()).resolves.toEqual({ error: `A decision maker persona cannot use a coding harness.` });
});

test(`deactivating the last coding harness persona is rejected`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Harness constraint loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  const personas = (await listResponse.json()) as Array<{ id: string; displayName: string; personality: string; usesCodingHarness: boolean; isDecisionMaker: boolean; lifecycleStatus: string; routingPriority: number }>;
  const ic = personas.find((p) => p.usesCodingHarness && !p.isDecisionMaker);
  expect(ic).toBeDefined();

  if (!ic) {
    throw new Error(`Coding harness persona not found.`);
  }

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${loop.id}/personas/${ic.id}`, {
    data: {
      displayName: ic.displayName,
      personality: ic.personality,
      usesCodingHarness: ic.usesCodingHarness,
      lifecycleStatus: `archived`,
      routingPriority: ic.routingPriority,
    },
  });
  expect(updateResponse.status()).toBe(400);
  await expect(updateResponse.json()).resolves.toEqual({ error: `At least one active persona with a coding harness is required.` });
});

test(`personas reject missing required fields`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona validation loop`);

  const response = await page.request.post(`http://athena.localhost/api/loops/${loop.id}/personas`, {
    data: {
      displayName: `   `,
      personality: `Valid personality`,
      usesCodingHarness: false,
      lifecycleStatus: `active`,
      routingPriority: 0,
    },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `displayName is required.` });
});

test(`personas page shows global persona list and create form`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/persona-list`);

  await expect(page.getByRole(`heading`, { level: 1, name: `Personas` })).toBeVisible();
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
  await page.goto(`http://athena.localhost/loops/${loop.id}`);

  await expect(page.getByRole(`heading`, { name: `Loop detail personas loop` })).toBeVisible();

  await page.getByRole(`tab`, { name: `Personas` }).click();

  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  const personas = (await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`)).json() as Promise<Array<{ displayName: string }>>;
  const personaList = await personas;
  expect(personaList.length).toBeGreaterThan(0);
});
