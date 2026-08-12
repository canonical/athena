import { authenticate, createLoop, expect, type Page, test } from "../../../testing/playwright/index.js";

const openRunnerList = async (page: Page) => {
  await page.goto(`http://athena.localhost/runner/list`);
  await expect(page.getByRole(`button`, { name: `Create runner` })).toBeVisible();
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

const getRunnerIdFromEditUrl = async (page: Page, displayName: string): Promise<string> => {
  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await expect(page).toHaveURL(/\/runner\/list\/edit\//);
  const runnerId = page.url().split(`/`).pop() ?? ``;
  expect(runnerId).toBeTruthy();
  await page.goBack();
  return runnerId;
};

const assignRepositoryToLoopViaUi = async (page: Page, loopId: string, repositoryName: string) => {
  await page.goto(`http://athena.localhost/loop/${loopId}/repositories`);

  await expect(page.getByRole(`heading`, { name: `Assigned repositories` })).toBeVisible();
  await page.getByRole(`button`, { name: `Assign repository` }).click();
  await expect(page.locator(`#assign-repository-select`)).toBeVisible();
  await page.locator(`#assign-repository-select`).selectOption({ label: repositoryName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign repository` }).click();

  await expect(page.getByText(`Repository has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: repositoryName, exact: true }).first()).toBeVisible();
};

const createRepositoryViaUi = async (page: Page, displayName: string) => {
  await page.goto(`http://athena.localhost/connection/repositories`);
  await expect(page.getByRole(`button`, { name: `Create repository` })).toBeVisible();

  await page.getByRole(`button`, { name: `Create repository` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`API base URL`).fill(`https://api.github.com`);
  await page.getByLabel(`Repository owner`).fill(`canonical`);
  await page.getByLabel(`Repository name`).fill(`athena-test-${Date.now()}`);
  await page.getByLabel(`GitHub token`).fill(`ghp_test_${Date.now()}`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create repository` }).click();

  await expect(page.getByText(`${displayName} is available in connections.`)).toBeVisible();
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

  await expect(page.getByRole(`heading`, { name: `Assigned runners` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Assign runner` })).toBeVisible();
  await page.getByRole(`button`, { name: `Assign runner` }).click();
  await expect(page.locator(`#assign-runner-select`)).toBeVisible();
  await page.locator(`#assign-runner-select`).selectOption({ label: runnerName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign runner` }).click();

  await expect(page.getByText(`Runner has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: runnerName, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Selection algorithm` }).click();
  await expect(page.getByRole(`dialog`)).toBeVisible();
  await page.locator(`#loop-runner-selection-algorithm`).selectOption(`highest-credit-absolute`);
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Save algorithm` }).click();
  await expect(page.getByText(`Runner selection algorithm has been updated.`)).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${runnerName}` }).click();
  await expect(page.getByText(`${runnerName} has been removed from this loop.`)).toBeVisible();
});

test(`loop runner repositories page supports assigned toggle and save`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Runner repository mapping loop ${Date.now()}`);
  const runnerName = `Repository mapped runner ${Date.now()}`;
  const repositoryName = `Test repo ${Date.now()}`;

  await createRunnerViaUi(page, runnerName);
  await createRepositoryViaUi(page, repositoryName);
  await assignRepositoryToLoopViaUi(page, loop.id, repositoryName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners`);
  await page.getByRole(`button`, { name: `Assign runner` }).click();
  await page.locator(`#assign-runner-select`).selectOption({ label: runnerName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign runner` }).click();
  await expect(page.getByText(`Runner has been assigned to this loop.`)).toBeVisible();

  const runnerRow = page.getByRole(`row`).filter({ hasText: runnerName });
  await expect(runnerRow.getByRole(`link`, { name: `Manage` })).toBeVisible();
  await runnerRow.getByRole(`link`, { name: `Manage` }).click();

  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/runners/.+/repositories`));
  await expect(page.getByRole(`heading`, { name: /Runner repositories/ })).toBeVisible();

  const assignedCheckbox = page.getByRole(`checkbox`).first();
  await expect(assignedCheckbox).toBeChecked();

  await assignedCheckbox.uncheck();
  await expect(page.getByRole(`button`, { name: `Save assignments` })).toBeEnabled();
  await page.getByRole(`button`, { name: `Save assignments` }).click();
  await expect(page.getByText(`Runner repository assignments have been updated.`)).toBeVisible();

  await page.getByRole(`button`, { name: `Refresh` }).click();
  await expect(assignedCheckbox).not.toBeChecked();

  await assignedCheckbox.check();
  await page.getByRole(`button`, { name: `Save assignments` }).click();
  await expect(page.getByText(`Runner repository assignments have been updated.`)).toBeVisible();
});

test(`runner detail page renders expected fields`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Detail runner ${Date.now()}`;
  await createRunnerViaUi(page, displayName);

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await expect(page).toHaveURL(/\/runner\/list\/edit\//);
  const currentUrl = page.url();
  const runnerId = currentUrl.split(`/`).pop();

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
  await page.goto(`http://athena.localhost/runner/list/edit/00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Runner not found`)).toBeVisible();
  await expect(page.getByText(`The selected runner no longer exists.`)).toBeVisible();
});

test(`loop runner repositories page shows empty state when loop has no assigned repositories`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `No-repo runner loop ${Date.now()}`);
  const runnerName = `No-repo runner ${Date.now()}`;

  await createRunnerViaUi(page, runnerName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners`);
  await page.getByRole(`button`, { name: `Assign runner` }).click();
  await page.locator(`#assign-runner-select`).selectOption({ label: runnerName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign runner` }).click();
  await expect(page.getByText(`Runner has been assigned to this loop.`)).toBeVisible();

  const runnerRow = page.getByRole(`row`).filter({ hasText: runnerName });
  await expect(runnerRow.getByRole(`link`, { name: `Manage` })).toBeVisible();
  await runnerRow.getByRole(`link`, { name: `Manage` }).click();

  await expect(page).toHaveURL(new RegExp(`/loop/${loop.id}/runners/.+/repositories`));
  await expect(page.getByRole(`heading`, { name: /Runner repositories/ })).toBeVisible();
  await expect(page.getByText(`No repositories are assigned to this loop yet.`)).toBeVisible();
});

test(`loop runner repositories page shows error for runner not in loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Unassigned runner repo loop ${Date.now()}`);
  const runnerName = `Unassigned repo runner ${Date.now()}`;

  await createRunnerViaUi(page, runnerName);
  await openRunnerList(page);
  const runnerId = await getRunnerIdFromEditUrl(page, runnerName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/runners/${runnerId}/repositories`);

  await expect(page.getByRole(`heading`, { name: /Runner repositories/ })).toBeVisible();
  await expect(page.getByText(`Unable to load runner repositories`)).toBeVisible();
});
