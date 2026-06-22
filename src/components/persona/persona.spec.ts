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

  const catalog = (await response.json()) as Array<{ role: string; displayName: string; usesCodingHarness: boolean; isEngineeringManager: boolean }>;
  expect(catalog.length).toBeGreaterThan(0);

  const roles = catalog.map((p) => p.role);
  expect(roles).toContain(`em`);
  expect(roles).toContain(`ic`);
  expect(roles).toContain(`cr`);
  expect(roles).toContain(`pm`);
  expect(roles).toContain(`qa`);
  expect(roles).toContain(`ux`);

  const em = catalog.find((p) => p.role === `em`);
  expect(em?.isEngineeringManager).toBe(true);
  expect(em?.usesCodingHarness).toBe(false);

  const ic = catalog.find((p) => p.role === `ic`);
  expect(ic?.usesCodingHarness).toBe(true);
  expect(ic?.isEngineeringManager).toBe(false);
});

test(`loop creation seeds an EM persona automatically`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona seed loop`);

  const response = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  expect(response.status()).toBe(200);

  const personas = (await response.json()) as Array<{ isEngineeringManager: boolean; displayName: string; lifecycleStatus: string }>;
  const emPersonas = personas.filter((p) => p.isEngineeringManager);
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
  const created = (await createResponse.json()) as { id: string; displayName: string; usesCodingHarness: boolean; isEngineeringManager: boolean };
  expect(created.displayName).toBe(`IC Persona`);
  expect(created.usesCodingHarness).toBe(true);
  expect(created.isEngineeringManager).toBe(false);

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

test(`EM persona cannot be deleted`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM delete guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  const personas = (await listResponse.json()) as Array<{ id: string; isEngineeringManager: boolean }>;
  const em = personas.find((p) => p.isEngineeringManager);
  expect(em).toBeDefined();

  const deleteResponse = await page.request.delete(`http://athena.localhost/api/loops/${loop.id}/personas/${em!.id}`);
  expect(deleteResponse.status()).toBe(400);
  await expect(deleteResponse.json()).resolves.toEqual({ error: `The engineering manager persona cannot be deleted.` });
});

test(`EM persona cannot be updated to use coding harness`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `EM harness guard loop`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loops/${loop.id}/personas`);
  const personas = (await listResponse.json()) as Array<{ id: string; isEngineeringManager: boolean; displayName: string; personality: string; lifecycleStatus: string; routingPriority: number }>;
  const em = personas.find((p) => p.isEngineeringManager);
  expect(em).toBeDefined();

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${loop.id}/personas/${em!.id}`, {
    data: {
      displayName: em!.displayName,
      personality: em!.personality,
      usesCodingHarness: true,
      lifecycleStatus: em!.lifecycleStatus,
      routingPriority: em!.routingPriority,
    },
  });
  expect(updateResponse.status()).toBe(400);
  await expect(updateResponse.json()).resolves.toEqual({ error: `An engineering manager persona cannot use a coding harness.` });
});

test(`deactivating the last coding harness persona is rejected`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Harness constraint loop`);

  const createResponse = await page.request.post(`http://athena.localhost/api/loops/${loop.id}/personas`, {
    data: {
      displayName: `Only IC`,
      personality: `You are the only IC.`,
      usesCodingHarness: true,
      lifecycleStatus: `active`,
      routingPriority: 1,
    },
  });
  expect(createResponse.status()).toBe(201);
  const ic = (await createResponse.json()) as { id: string };

  const updateResponse = await page.request.put(`http://athena.localhost/api/loops/${loop.id}/personas/${ic.id}`, {
    data: {
      displayName: `Only IC`,
      personality: `You are the only IC.`,
      usesCodingHarness: true,
      lifecycleStatus: `archived`,
      routingPriority: 1,
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

test(`personas page shows loop selector and reference catalog`, async ({ page }) => {
  await authenticate(page);
  await createLoop(page, `Persona UI loop`);
  await page.goto(`http://athena.localhost/personas`);

  await expect(page.getByRole(`heading`, { name: `Personas` })).toBeVisible();
  await expect(page.getByLabel(`Loop`)).toBeVisible();

  await page.getByLabel(`Loop`).selectOption({ label: `Persona UI loop` });

  await expect(page.getByText(`Reference persona templates`)).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Engineering Manager`, exact: true })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Individual Contributor`, exact: true })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Code Reviewer`, exact: true })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Product Manager`, exact: true })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Quality Assurance`, exact: true })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `User Experience`, exact: true })).toBeVisible();
});

test(`personas page supports add update and delete of non-EM persona`, async ({ page }) => {
  await authenticate(page);
  await createLoop(page, `Persona UI CRUD loop`);
  await page.goto(`http://athena.localhost/personas`);

  await page.getByLabel(`Loop`).selectOption({ label: `Persona UI CRUD loop` });

  await page.getByRole(`button`, { name: `Individual Contributor` }).click();

  await expect(page.getByLabel(`Display name`)).toHaveValue(`Individual Contributor`);

  await page.getByRole(`button`, { name: `Add persona` }).click();

  await expect(page.getByText(`Individual Contributor has been added to the loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Individual Contributor`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Edit Individual Contributor` }).click();
  await page.getByLabel(`Display name`).fill(`IC Updated`);
  await page.getByRole(`button`, { name: `Save persona` }).click();

  await expect(page.getByText(`IC Updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `IC Updated`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Delete IC Updated` }).click();

  await expect(page.getByText(`IC Updated has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `IC Updated`, exact: true })).toHaveCount(0);
});
