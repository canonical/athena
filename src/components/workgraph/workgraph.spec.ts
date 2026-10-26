import { assignWorkgraphToLoopViaUi, authenticate, createLoop, createWorkgraphViaUi, expect, test } from "../../../testing/playwright/index.js";

test(`workgraph sync runs in the worker and reports an upstream failure`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Workgraph sync loop ${Date.now()}`);
  const workgraphName = `Unavailable Jira ${Date.now()}`;

  await createWorkgraphViaUi(page, workgraphName);
  await assignWorkgraphToLoopViaUi(page, loop.id, workgraphName);
  await page.getByRole(`button`, { name: `Close active modal` }).click();

  await page.getByRole(`button`, { name: workgraphName, exact: true }).first().click();
  await page.locator(`#workgraph-jql-input`).fill(`project = ATHENA`);
  await page.getByRole(`button`, { name: `Save`, exact: true }).click();
  await expect(page.getByText(`Workgraph configuration has been saved.`)).toBeVisible();

  await page.getByRole(`tab`, { name: `Synced Items` }).click();
  await page.getByRole(`button`, { name: `Sync work items`, exact: true }).click();
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Sync work items`, exact: true }).click();
  await expect(page.getByText(`Sync scheduled`)).toBeVisible();

  await page.getByRole(`tab`, { name: `Definitions`, exact: true }).click();
  await expect(page.getByRole(`row`, { name: new RegExp(workgraphName, `u`) })).toContainText(`Last sync failed`, { timeout: 30_000 });
});
