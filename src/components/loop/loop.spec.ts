import { authenticate, createLoop, createProviderViaUi, dexEmail, dexLoopMemberEmail, expect, test } from "../../../testing/playwright/index.js";

test(`loop list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/`);

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

test(`loop membership UI lists members and pending invites`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Membership UI loop ${Date.now()}`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);

  await expect(page.getByRole(`heading`, { name: `Loop members` })).toBeVisible();
  await expect(page.getByRole(`row`, { name: new RegExp(`${dexEmail}.*Admin`) })).toBeVisible();
  await expect(page.getByText(`No pending invites for this loop.`)).toBeVisible();

  const invitedEmail = `pending-invite-${Date.now()}@example.com`;
  await page.getByRole(`button`, { name: `Invite member` }).click();
  await page.getByLabel(`Email`).fill(invitedEmail);
  await page.getByRole(`button`, { name: `Send invite` }).click();

  await expect(page.getByText(`Pending invite for ${invitedEmail} created successfully.`)).toBeVisible();
  await expect(page.getByRole(`row`, { name: new RegExp(invitedEmail) })).toBeVisible();
});

test(`loop membership UI prevents demoting the last admin`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Last admin guard loop ${Date.now()}`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);

  const adminRow = page.getByRole(`row`).filter({ hasText: dexEmail }).filter({ hasText: `Admin` });
  await expect(adminRow).toBeVisible();
  await expect(adminRow.getByRole(`button`, { name: `Demote` })).toBeDisabled();
});

test(`loop invite can be accepted by another dex user and promoted to admin`, async ({ page }) => {
  await authenticate(page, { email: dexEmail, password: `password` });

  const loop = await createLoop(page, `Invite acceptance loop ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await expect(page.getByRole(`heading`, { name: `Loop members` })).toBeVisible();
  await page.getByRole(`button`, { name: `Invite member` }).click();
  await page.getByLabel(`Email`).fill(dexLoopMemberEmail);
  await page.getByRole(`button`, { name: `Send invite` }).click();

  await expect(page.getByText(`Pending invite for ${dexLoopMemberEmail} created successfully.`)).toBeVisible();
  await expect(page.getByRole(`row`, { name: new RegExp(dexLoopMemberEmail) })).toBeVisible();

  await authenticate(page, { email: dexLoopMemberEmail, password: `password` });
  await page.goto(`http://athena.localhost/`);

  await expect(page.getByRole(`row`, { name: new RegExp(loop.name) })).toBeVisible();
  await page
    .getByRole(`row`, { name: new RegExp(loop.name) })
    .getByRole(`button`, { name: `Accept invite` })
    .click();
  await expect(page.getByText(`You have joined ${loop.name}.`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/task/list$`));

  await page.goto(`http://athena.localhost/loop/${loop.id}/members`, { waitUntil: `domcontentloaded` });
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/members$`));
  await expect(page.getByRole(`heading`, { name: `Loop members` })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Loading page...`)).toHaveCount(0);
  await expect(page.getByText(`Loading members...`)).toHaveCount(0);
  const invitedMemberRow = page.getByRole(`row`).filter({ hasText: dexLoopMemberEmail });
  await expect(invitedMemberRow).toBeVisible();
  await expect(invitedMemberRow).toContainText(`Member`);

  await authenticate(page, { email: dexEmail, password: `password` });
  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await page
    .getByRole(`row`, { name: new RegExp(dexLoopMemberEmail) })
    .getByRole(`button`, { name: `Promote` })
    .click();
  await expect(page.getByText(`${dexLoopMemberEmail} is now an admin.`)).toBeVisible();

  await authenticate(page, { email: dexLoopMemberEmail, password: `password` });
  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await expect(page.getByRole(`heading`, { name: `Loop members` })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Loading page...`)).toHaveCount(0);
  await expect(page.getByText(`Loading members...`)).toHaveCount(0);
  const promotedMemberRow = page.getByRole(`row`).filter({ hasText: dexLoopMemberEmail });
  await expect(promotedMemberRow).toBeVisible();
  await expect(promotedMemberRow).toContainText(`Admin`);
});

test(`loops page supports create update and delete`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/`);

  const createName = `UI loop ${Date.now()}`;
  const updateName = `${createName} updated`;

  await expect(page.getByRole(`button`, { name: `Create` })).toBeVisible();
  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(createName);
  await page.getByLabel(`Loop description`).fill(`Loop created through the UI`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`${createName} is ready to receive tasks.`)).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: createName, exact: true }).first()).toBeVisible();

  const createdRow = page
    .getByRole(`row`)
    .filter({ has: page.getByRole(`link`, { name: createName, exact: true }) })
    .first();
  await createdRow.getByRole(`button`, { name: `Edit` }).click();
  await page.getByLabel(`Loop name`).first().fill(updateName);
  await page.getByLabel(`Loop description`).first().fill(`Updated through the UI`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`${updateName} has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updateName, exact: true }).first()).toBeVisible();

  page.once(`dialog`, (dialog) => dialog.accept());
  const updatedRow = page
    .getByRole(`row`)
    .filter({ has: page.getByRole(`link`, { name: updateName, exact: true }) })
    .first();
  await updatedRow.getByRole(`button`, { name: `Delete` }).click();

  await expect(page.getByText(`${updateName} has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updateName, exact: true })).toHaveCount(0);
});

test(`loop list allows navigating to loop detail page`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/`);

  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(`Navigation test loop`);
  await page.getByLabel(`Loop description`).fill(`Loop for navigation test`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`Navigation test loop is ready to receive tasks.`)).toBeVisible();

  await page.getByRole(`link`, { name: `Navigation test loop` }).click();

  // Should navigate to task list (default redirect from loop root)
  await expect(page).toHaveURL(/\/loop\/[0-9a-f-]+\/task\/list/);
});

test(`loop detail page routes are deep-linkable`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Deep link tab loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/personas$`));
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/providers$`));
  await expect(page.getByRole(`heading`, { name: `Assigned providers` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Selection algorithm` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Assign provider` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/members$`));
  await expect(page.getByRole(`heading`, { name: `Loop members` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Invite member` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners`);
  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/runners$`));
  await expect(page.getByRole(`heading`, { name: `Assigned runners` })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole(`button`, { name: `Selection algorithm` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Assign runner` })).toBeVisible();
});

test(`providers tab keeps assign-provider section visible even when provider list is empty`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Providers tab visibility loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);

  await expect(page.getByRole(`heading`, { name: `Assigned providers` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Assign provider` })).toBeVisible();
});

test(`loop detail page saves loop details from the Details tab`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Detail save loop`, `Original description`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/details`);

  await page.getByRole(`button`, { name: `Edit loop` }).click();
  await page.getByLabel(`Loop name`).fill(`Detail save loop updated`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`Detail save loop updated has been updated.`)).toBeVisible();
  await expect(page.locator(`dd`).getByText(`Detail save loop updated`, { exact: true })).toBeVisible();
});

test(`loop admins can enable and disable searchable history memory`, async ({ page }) => {
  await authenticate(page);

  const providerName = `History embedder ${Date.now()}`;
  const replacementProviderName = `Replacement history embedder ${Date.now()}`;
  await createProviderViaUi(page, providerName, `unused-provider-credential`, { embedder: { model: `deterministic-embed-1536` } });
  await createProviderViaUi(page, replacementProviderName, `unused-replacement-provider-credential`, { embedder: { model: `deterministic-embed-1536` } });
  const loop = await createLoop(page, `History memory loop ${Date.now()}`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/details`);

  const saveButton = page.getByRole(`button`, { name: `Save history memory` });
  await expect(saveButton).toBeDisabled();

  await page.getByText(`Create a searchable RAG index from this loop's history`, { exact: true }).click();
  await expect(page.getByText(`Indexing the whole loop might take some time.`)).toBeVisible();
  await page.getByLabel(`Embedding provider`).selectOption({ label: `${providerName} (deterministic-embed-1536)` });

  page.once(`dialog`, async (dialog) => {
    expect(dialog.message()).toContain(`rebuild the loop's history index`);
    await dialog.dismiss();
  });
  await saveButton.click();
  await expect(saveButton).toBeEnabled();

  page.once(`dialog`, async (dialog) => {
    expect(dialog.message()).toContain(`rebuild the loop's history index`);
    await dialog.accept();
  });
  await saveButton.click();

  await expect(page.getByText(`The loop history memory settings were saved.`)).toBeVisible();
  await expect(page.getByLabel(`Create a searchable RAG index from this loop's history`)).toBeChecked();
  await expect(saveButton).toBeDisabled();

  const memoryConfigPath = `http://athena.localhost/api/loop/${loop.id}/history-memory`;
  await expect
    .poll(async () => {
      const response = await page.request.get(memoryConfigPath);
      return ((await response.json()) as { status: string | null }).status;
    })
    .toBe(`ready`);
  const readyConfigResponse = await page.request.get(memoryConfigPath);
  const readyConfig = (await readyConfigResponse.json()) as { hasHistoryRag: boolean; provider: string; status: string; updatedAt: string };
  const unchangedResponse = await page.request.put(memoryConfigPath, { data: { hasHistoryRag: true, provider: readyConfig.provider } });
  expect(unchangedResponse.ok()).toBe(true);
  const unchangedConfig = (await unchangedResponse.json()) as { status: string; updatedAt: string };
  expect(unchangedConfig.status).toBe(`ready`);
  expect(unchangedConfig.updatedAt).toBe(readyConfig.updatedAt);

  await page.getByLabel(`Embedding provider`).selectOption({ label: `${replacementProviderName} (deterministic-embed-1536)` });
  await expect(page.getByText(`Indexing the whole loop might take some time.`)).toBeVisible();
  page.once(`dialog`, async (dialog) => {
    expect(dialog.message()).toContain(`rebuild the loop's history index`);
    await dialog.accept();
  });
  await saveButton.click();
  await expect(page.getByText(`The loop history memory settings were saved.`)).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await page.getByText(`Create a searchable RAG index from this loop's history`, { exact: true }).click();
  await saveButton.click();
  await page.reload();
  await expect(page.getByLabel(`Create a searchable RAG index from this loop's history`)).not.toBeChecked();
  await expect(page.getByLabel(`Embedding provider`)).toBeDisabled();
  const disabledConfigResponse = await page.request.get(memoryConfigPath);
  expect(disabledConfigResponse.ok()).toBe(true);
  expect(((await disabledConfigResponse.json()) as { status: string | null }).status).toBe(`missing`);
  await expect(page.getByText(`The loop's existing history is being indexed.`)).toHaveCount(0);
  await expect(page.getByText(`History indexing failed`)).toHaveCount(0);
  await expect(page.getByText(`The loop's indexed history is ready for lookup.`)).toHaveCount(0);
});

test(`loop details tab shows no paused banner for a properly configured loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Paused routing loop`);

  // Navigate directly to the Details tab without visiting the Personas tab first.
  // The persona list is fetched at the Loop level so the routing count is available on any tab.
  await page.goto(`http://athena.localhost/loop/${loop.id}/details`);

  await expect(page.getByText(`Loop is paused`)).toHaveCount(0);
});

test(`loop detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/not-a-uuid`);

  await expect(page.getByText(`Unable to load loop`)).toBeVisible();
  await expect(page.getByText(`loop must be a valid UUID.`)).toBeVisible();
});

test(`loop detail page defaults to task list route`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop with tasks tab ${Date.now()}`);

  // Navigate to loop root - should redirect to task list
  await page.goto(`http://athena.localhost/loop/${loop.id}`);
  await expect(page).toHaveURL(/\/loop\/[0-9a-f-]+\/task\/list/);

  // Deep linking to personas route works
  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  // Deep linking to task list works
  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await expect(page).toHaveURL(/\/loop\/[0-9a-f-]+\/task\/list/);
});
