import { authenticate, createLoop, expect, type Page, test } from "../../../testing/playwright/index.js";

const openHarnessList = async (page: Page) => {
  await page.goto(`http://athena.localhost/harness/list`);
  await expect(page.getByRole(`heading`, { name: `Harnesses` })).toBeVisible();
};

const createHarnessViaUi = async (page: Page, displayName: string) => {
  await openHarnessList(page);

  await page.getByRole(`button`, { name: `Create harness` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`API key`).fill(`copilot-${Date.now()}`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create harness` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
};

test(`harness list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/harness/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`harnesses page supports create edit and delete`, async ({ page }) => {
  await authenticate(page);

  const displayName = `UI harness ${Date.now()}`;
  const updatedName = `${displayName} updated`;

  await createHarnessViaUi(page, displayName);

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await page.getByLabel(`Display name`).fill(updatedName);
  await page.getByRole(`button`, { name: `Save harness` }).click();

  await expect(page.getByText(`${updatedName} has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Delete ${updatedName}` }).click();
  await expect(page.getByText(`${updatedName} has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true })).toHaveCount(0);
});

test(`loop harnesses tab supports assign remove and algorithm save`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Harness assignment loop ${Date.now()}`);
  const harnessName = `Assignable harness ${Date.now()}`;

  await createHarnessViaUi(page, harnessName);

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=harnesses`);

  await expect(page.getByRole(`heading`, { name: `Assign an existing harness` })).toBeVisible();
  await page.getByLabel(`Harness`).selectOption({ label: harnessName });
  await page.getByRole(`button`, { name: `Assign harness` }).click();

  await expect(page.getByText(`Harness has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: harnessName, exact: true }).first()).toBeVisible();

  await page.getByLabel(`Algorithm`).selectOption(`highest-credit-absolute`);
  await page.getByRole(`button`, { name: `Save algorithm` }).click();
  await expect(page.getByText(`Harness selection algorithm has been updated.`)).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${harnessName}` }).click();
  await expect(page.getByText(`${harnessName} has been removed from this loop.`)).toBeVisible();
});

test(`harness detail page renders expected fields`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Detail harness ${Date.now()}`;
  await createHarnessViaUi(page, displayName);

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await expect(page).toHaveURL(/\/harness\/list\?edit=/);
  const currentUrl = page.url();
  const harnessId = new URL(currentUrl).searchParams.get(`edit`);

  expect(harnessId).toBeTruthy();
  await page.goto(`http://athena.localhost/harness/${harnessId}`);

  await expect(page.getByRole(`heading`, { name: displayName })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Harness details` })).toBeVisible();
  await expect(page.getByText(`github-copilot-cloud`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Credential configured`)).toBeVisible();
});

test(`harness detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/harness/not-a-uuid`);

  await expect(page.getByText(`Unable to load harness`)).toBeVisible();
  await expect(page.getByText(`harnessId must be a valid UUID.`)).toBeVisible();
});

test(`harness list edit drawer shows not found message for unknown harness id`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/harness/list?edit=00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Harness not found`)).toBeVisible();
  await expect(page.getByText(`The selected harness no longer exists.`)).toBeVisible();
});
