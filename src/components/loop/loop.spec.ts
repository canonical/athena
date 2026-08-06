import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`loop list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/loop/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`loop API uses root routes`, async ({ page }) => {
  await authenticate(page);

  const createName = `API root loop ${Date.now()}`;
  const createResponse = await page.request.post(`http://athena.localhost/api/loop`, {
    data: {
      name: createName,
      description: `Created through API root route`,
    },
  });

  expect(createResponse.ok()).toBe(true);
  const created = (await createResponse.json()) as { id: string; name: string };
  expect(created.name).toBe(createName);
  expect(created.id).toBeTruthy();

  const listResponse = await page.request.get(`http://athena.localhost/api/loop`);
  expect(listResponse.ok()).toBe(true);
  const loops = (await listResponse.json()) as Array<{ id: string }>;
  expect(loops.some((loop) => loop.id === created.id)).toBe(true);
});

test(`loop provider selection policy uses providerSelectionAlgorithm`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Provider policy field loop ${Date.now()}`);
  const policyPath = `http://athena.localhost/api/loop/${loop.id}/provider-selection-policy`;

  const updateResponse = await page.request.put(policyPath, {
    data: {
      providerSelectionAlgorithm: `highest-credit-absolute`,
      runnerSelectionAlgorithm: `highest-credit-absolute`,
    },
  });

  expect(updateResponse.ok()).toBe(true);
  const updatedPolicy = (await updateResponse.json()) as {
    providerSelectionAlgorithm: string;
    providerSelectionCursor: number;
    runnerSelectionAlgorithm: string;
    runnerSelectionCursor: number;
    updatedAt: string;
  };
  expect(updatedPolicy.providerSelectionAlgorithm).toBe(`highest-credit-absolute`);
  expect(updatedPolicy.providerSelectionCursor).toBeGreaterThanOrEqual(0);
  expect(updatedPolicy.runnerSelectionAlgorithm).toBe(`highest-credit-absolute`);
  expect(updatedPolicy.runnerSelectionCursor).toBeGreaterThanOrEqual(0);
  expect(Object.keys(updatedPolicy).sort()).toEqual([`loop`, `providerSelectionAlgorithm`, `providerSelectionCursor`, `runnerSelectionAlgorithm`, `runnerSelectionCursor`, `updatedAt`]);

  const getResponse = await page.request.get(policyPath);
  expect(getResponse.ok()).toBe(true);
  const loadedPolicy = (await getResponse.json()) as {
    providerSelectionAlgorithm: string;
    providerSelectionCursor: number;
    runnerSelectionAlgorithm: string;
    runnerSelectionCursor: number;
    updatedAt: string;
  };
  expect(loadedPolicy.providerSelectionAlgorithm).toBe(`highest-credit-absolute`);
  expect(loadedPolicy.providerSelectionCursor).toBeGreaterThanOrEqual(0);
  expect(loadedPolicy.runnerSelectionAlgorithm).toBe(`highest-credit-absolute`);
  expect(loadedPolicy.runnerSelectionCursor).toBeGreaterThanOrEqual(0);
  expect(Object.keys(loadedPolicy).sort()).toEqual([`loop`, `providerSelectionAlgorithm`, `providerSelectionCursor`, `runnerSelectionAlgorithm`, `runnerSelectionCursor`, `updatedAt`]);
});

test(`loop tools API exposes requiresApproval metadata`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Tool metadata loop ${Date.now()}`);
  const response = await page.request.get(`http://athena.localhost/api/loop/${loop.id}/tools`);

  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    loop: string;
    tools: Array<{ name: string; description: string; enabled: boolean; requiresApproval: boolean }>;
  };

  expect(payload.loop).toBe(loop.id);
  expect(Array.isArray(payload.tools)).toBe(true);
  expect(payload.tools.length).toBeGreaterThan(0);

  const createIssue = payload.tools.find((tool) => tool.name === `jira_create_issue`);
  const readIssue = payload.tools.find((tool) => tool.name === `jira_read_issue`);

  expect(createIssue?.requiresApproval).toBe(true);
  expect(readIssue?.requiresApproval).toBe(false);
});

test(`loops page supports create update and delete`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/list`);

  await expect(page.getByRole(`button`, { name: `Create` })).toBeVisible();
  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(`UI loop`);
  await page.getByLabel(`Loop description`).fill(`Loop created through the UI`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`UI loop is ready to receive tasks.`)).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop`, exact: true }).first()).toBeVisible();

  await page
    .getByRole(`row`, { name: /UI loop/ })
    .getByRole(`button`, { name: `Edit` })
    .click();
  await page.getByLabel(`Loop name`).first().fill(`UI loop updated`);
  await page.getByLabel(`Loop description`).first().fill(`Updated through the UI`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`UI loop updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true }).first()).toBeVisible();

  await page
    .getByRole(`row`, { name: /UI loop updated/ })
    .getByRole(`button`, { name: `Delete` })
    .click();

  await expect(page.getByText(`UI loop updated has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true })).toHaveCount(0);
});

test(`loop list allows navigating to loop detail page`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/list`);

  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(`Navigation test loop`);
  await page.getByLabel(`Loop description`).fill(`Loop for navigation test`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`Navigation test loop is ready to receive tasks.`)).toBeVisible();

  await page.getByRole(`link`, { name: `Navigation test loop` }).click();

  await expect(page.getByRole(`heading`, { name: `Navigation test loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Details` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Providers` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Runners` })).toBeVisible();
});

test(`loop detail page tabs are deep-linkable`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Deep link tab loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);

  await expect(page.getByRole(`heading`, { name: `Deep link tab loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);
  await expect(page.getByRole(`tab`, { name: `Providers` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned providers` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Provider selection algorithm` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Assign an existing provider` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners`);
  await expect(page.getByRole(`tab`, { name: `Runners` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned runners` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Runner selection algorithm` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Assign an existing runner` })).toBeVisible();
});

test(`providers tab keeps assign-provider section visible even when provider list is empty`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Providers tab visibility loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);

  await expect(page.getByRole(`heading`, { name: `Assign an existing provider` })).toBeVisible();
});

test(`loop detail page saves loop details from the Details tab`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Detail save loop`, `Original description`);
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  await expect(page.getByRole(`tab`, { name: `Details` })).toHaveAttribute(`aria-selected`, `true`);
  await page.getByRole(`button`, { name: `Edit loop` }).click();
  await page.getByLabel(`Loop name`).fill(`Detail save loop updated`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`Detail save loop updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Detail save loop updated` })).toBeVisible();
});

test(`loop details tab shows no paused banner for a properly configured loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Paused routing loop`);

  // Navigate directly to the Details tab without visiting the Personas tab first.
  // The persona list is fetched at the Loop level so the routing count is available on any tab.
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  await expect(page.getByRole(`heading`, { name: `Paused routing loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Details` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByText(`Loop is paused`)).toHaveCount(0);
});

test(`loop detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/not-a-uuid`);

  await expect(page.getByText(`Unable to load loop`)).toBeVisible();
  await expect(page.getByText(`loop must be a valid UUID.`)).toBeVisible();
});

test(`loop detail page has tasks tab as first tab`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop with tasks tab ${Date.now()}`);

  // Navigate to loop detail - should default to tasks tab
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  // Tasks tab should be first and active by default
  await expect(page.getByRole(`tab`, { name: `Tasks` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Tasks` })).toHaveAttribute(`aria-selected`, `true`);

  // Verify tab order: Tasks, Details, Personas, Providers, Runners
  const tabButtons = await page.getByRole(`tab`).all();
  const tabNames = await Promise.all(tabButtons.map((btn) => btn.textContent()));
  expect(tabNames).toEqual([`Tasks`, `Details`, `Tools`, `Personas`, `Providers`, `Runners`, `Workgraphs`, `Repositories`]);

  // Can navigate to details tab
  await page.getByRole(`tab`, { name: `Details` }).click();
  await expect(page.getByRole(`tab`, { name: `Details` })).toHaveAttribute(`aria-selected`, `true`);

  // Can navigate back to tasks tab
  await page.getByRole(`tab`, { name: `Tasks` }).click();
  await expect(page.getByRole(`tab`, { name: `Tasks` })).toHaveAttribute(`aria-selected`, `true`);

  // Deep linking to other tabs works
  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);
  await expect(page.getByRole(`tab`, { name: `Personas` })).toHaveAttribute(`aria-selected`, `true`);

  // Deep linking back to tasks works
  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await expect(page.getByRole(`tab`, { name: `Tasks` })).toHaveAttribute(`aria-selected`, `true`);
});
