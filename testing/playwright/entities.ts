import { expect, type Page } from "@playwright/test";
import { inferenceBaseUrl } from "./inference.js";

const assignToLoop = async (page: Page, loopId: string, options: { tab: string; heading: string; button: string; select: string; confirm: string; toast: string; label: string }) => {
  await page.goto(`http://athena.localhost/loop/${loopId}/${options.tab}`);
  await expect(page.getByRole(`heading`, { name: options.heading })).toBeVisible();

  await page.getByRole(`button`, { name: options.button }).click();
  await expect(page.locator(options.select)).toBeVisible();
  await page.locator(options.select).selectOption({ label: options.label });
  await page.getByRole(`dialog`).getByRole(`button`, { name: options.confirm }).click();

  await expect(page.getByText(options.toast)).toBeVisible({ timeout: 20_000 });
};

const defaultProviderCredential = `unused-provider-credential`;

export const createProviderViaUi = async (page: Page, displayName: string, apiKey: string = defaultProviderCredential) => {
  await page.goto(`http://athena.localhost/provider/list`);
  await expect(page.getByRole(`button`, { name: `Create provider` })).toBeVisible();

  await page.getByRole(`button`, { name: `Create provider` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Base URL`).fill(inferenceBaseUrl);
  await page.getByLabel(`API key`).fill(apiKey);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create provider` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
};

export const configureProviderModelsViaUi = async (page: Page, displayName: string, capability: `chat` | `embedding`, modelId: string) => {
  await page.goto(`http://athena.localhost/provider/list`);
  const href = await page.getByRole(`link`, { name: displayName, exact: true }).first().getAttribute(`href`);
  const capabilityLabel = capability === `chat` ? `Chat` : `Embedding`;

  // A page-level `on` handler would outlive this helper and interfere with later dialogs.
  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.goto(`http://athena.localhost${href}/settings`);

  await expect(page.getByRole(`button`, { name: `Fetch models` })).toBeVisible({ timeout: 5000 });
  await page.getByRole(`button`, { name: `Fetch models` }).click();
  await expect(page.locator(`#provider-${capability}-enabled-model-${modelId}`)).toBeVisible();

  const clearButton = page.getByRole(`button`, { name: `Clear all ${capabilityLabel} models` });

  if (await clearButton.isEnabled()) {
    await clearButton.click();
  }

  await page.locator(`#provider-${capability}-enabled-model-${modelId}`).check();
  await page.locator(`#provider-${capability}-default-model`).selectOption(modelId);
  await page.getByRole(`button`, { name: `Save model settings` }).click();

  await expect(page.getByText(`Provider model settings have been updated.`)).toBeVisible({ timeout: 20_000 });
};

export const assignProviderToLoopViaUi = (page: Page, loopId: string, label: string) =>
  assignToLoop(page, loopId, { tab: `providers`, heading: `Assigned providers`, button: `Assign provider`, select: `#assign-provider-select`, confirm: `Assign`, toast: `Provider has been assigned to this loop.`, label });

export const createRunnerViaUi = async (page: Page, displayName: string) => {
  await page.goto(`http://athena.localhost/runner/list`);
  await expect(page.getByRole(`button`, { name: `Create runner` })).toBeVisible();

  await page.getByRole(`button`, { name: `Create runner` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  // Readiness needs an assignment, not a live runner connection.
  await page.getByLabel(`API key`).fill(`unused-runner-credential`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create runner` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
};

export const assignRunnerToLoopViaUi = (page: Page, loopId: string, label: string) =>
  assignToLoop(page, loopId, { tab: `runners`, heading: `Assigned runners`, button: `Assign runner`, select: `#assign-runner-select`, confirm: `Assign runner`, toast: `Runner has been assigned to this loop.`, label });

export const createWorkgraphViaUi = async (page: Page, name: string) => {
  await page.goto(`http://athena.localhost/connection/workgraphs`);
  await expect(page.getByRole(`button`, { name: `Create workgraph` })).toBeVisible();

  await page.getByRole(`button`, { name: `Create workgraph` }).first().click();
  // `Base URL` also matches `Browse base URL`, so use exact field ids.
  await page.locator(`#workgraph-editor-name`).fill(name);
  await page.locator(`#workgraph-editor-base-url`).fill(`https://jira.invalid`);
  await page.locator(`#workgraph-editor-email`).fill(`unused@example.invalid`);
  await page.locator(`#workgraph-editor-api-key`).fill(`unused-workgraph-credential`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create` }).click();

  await expect(page.getByRole(`gridcell`, { name, exact: true }).first()).toBeVisible({ timeout: 20_000 });
};

export const assignWorkgraphToLoopViaUi = (page: Page, loopId: string, label: string) =>
  assignToLoop(page, loopId, { tab: `workgraphs`, heading: `Assigned workgraphs`, button: `Assign workgraph`, select: `#assign-workgraph-select`, confirm: `Assign workgraph`, toast: `Workgraph has been assigned to this loop.`, label });
