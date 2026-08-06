import { authenticate, createLoop, expect, type Page, test } from "../../../testing/playwright/index.js";

const openRunnerList = async (page: Page) => {
  await page.goto(`http://athena.localhost/runner/list`);
  await expect(page.getByRole(`heading`, { name: `Runners` })).toBeVisible();
};

const createRunnerViaUi = async (page: Page, displayName: string) => {
  await openRunnerList(page);

  await page.getByRole(`button`, { name: `Create runner` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`API key`).fill(`copilot-${Date.now()}`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create runner` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
};

test(`runner list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/runner/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`runners page supports create edit and delete`, async ({ page }) => {
  await authenticate(page);

  const displayName = `UI runner ${Date.now()}`;
  const updatedName = `${displayName} updated`;

  await createRunnerViaUi(page, displayName);

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await page.getByLabel(`Display name`).fill(updatedName);
  await page.getByRole(`button`, { name: `Save runner` }).click();

  await expect(page.getByText(`${updatedName} has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Delete ${updatedName}` }).click();
  await expect(page.getByText(`${updatedName} has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true })).toHaveCount(0);
});

test(`loop runners tab supports assign remove and algorithm save`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Runner assignment loop ${Date.now()}`);
  const runnerName = `Assignable runner ${Date.now()}`;

  await createRunnerViaUi(page, runnerName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners`);

  await expect(page.getByRole(`heading`, { name: `Assign an existing runner` })).toBeVisible();
  await page.getByLabel(`Runner`).selectOption({ label: runnerName });
  await page.getByRole(`button`, { name: `Assign runner` }).click();

  await expect(page.getByText(`Runner has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: runnerName, exact: true }).first()).toBeVisible();

  await page.getByLabel(`Algorithm`).selectOption(`highest-credit-absolute`);
  await page.getByRole(`button`, { name: `Save algorithm` }).click();
  await expect(page.getByText(`Runner selection algorithm has been updated.`)).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${runnerName}` }).click();
  await expect(page.getByText(`${runnerName} has been removed from this loop.`)).toBeVisible();
});

test(`runner detail page renders expected fields`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Detail runner ${Date.now()}`;
  await createRunnerViaUi(page, displayName);

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await expect(page).toHaveURL(/\/runner\/list\?edit=/);
  const currentUrl = page.url();
  const runnerId = new URL(currentUrl).searchParams.get(`edit`);

  expect(runnerId).toBeTruthy();
  await page.goto(`http://athena.localhost/runner/${runnerId}`);

  await expect(page.getByRole(`heading`, { name: displayName })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Runner details` })).toBeVisible();
  await expect(page.getByText(`github-copilot-cloud`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Credential configured`)).toBeVisible();
});

test(`runner detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/runner/not-a-uuid`);

  await expect(page.getByText(`Unable to load runner`)).toBeVisible();
  await expect(page.getByText(`runner must be a valid UUID.`)).toBeVisible();
});

test(`runner list edit drawer shows not found message for unknown runner id`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/runner/list?edit=00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Runner not found`)).toBeVisible();
  await expect(page.getByText(`The selected runner no longer exists.`)).toBeVisible();
});
