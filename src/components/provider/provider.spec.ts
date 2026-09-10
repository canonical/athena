import { authenticate, configureProviderModelsViaUi, createLoop, createProviderViaUi, expect, inferenceBaseUrl, type Page, scenario, test, testInferenceChatModel, testInferenceEmbeddingModel } from "../../../testing/playwright/index.js";

const providerCredential = `provider-credential`;

const openProviderList = async (page: Page) => {
  await page.goto(`http://athena.localhost/provider/list`);
  await expect(page.getByRole(`button`, { name: `Create provider` })).toBeVisible();
};

test(`provider list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/provider/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`providers page supports create edit and delete`, async ({ page }) => {
  await authenticate(page);

  const displayName = `UI provider ${Date.now()}`;
  const updatedName = `${displayName} updated`;

  await createProviderViaUi(page, displayName);

  await expect(page.getByRole(`button`, { name: `Edit ${displayName}` }).first()).toBeVisible({ timeout: 5000 });
  await page
    .getByRole(`button`, { name: `Edit ${displayName}` })
    .first()
    .click();
  await page.getByLabel(`Display name`).fill(updatedName);
  await page.getByRole(`button`, { name: `Save provider` }).click();

  await expect(page.getByText(`${updatedName} has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true }).first()).toBeVisible();

  await page
    .getByRole(`button`, { name: `Edit ${updatedName}` })
    .first()
    .click();
  await page.locator(`form`).first().getByRole(`button`, { name: `Delete provider` }).click();
  await expect(page.getByText(`${updatedName} has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedName, exact: true })).toHaveCount(0);
});

test(`provider editor rejects a base URL that is neither HTTP nor HTTPS`, async ({ page }) => {
  await authenticate(page);
  await openProviderList(page);

  await page.getByRole(`button`, { name: `Create provider` }).first().click();
  await page.getByLabel(`Display name`).fill(`Invalid URL provider`);
  await page.getByLabel(`Base URL`).fill(`ftp://openrouter.ai/api/v1`);
  await page.getByLabel(`API key`).fill(providerCredential);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create provider` }).click();

  await expect(page.getByText(`baseUrl must use HTTP or HTTPS.`)).toBeVisible();
});

test(`provider editor accepts an HTTP base URL`, async ({ page }) => {
  await authenticate(page);
  await openProviderList(page);

  const displayName = `HTTP provider ${Date.now()}`;

  await page.getByRole(`button`, { name: `Create provider` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Base URL`).fill(inferenceBaseUrl);
  await page.getByLabel(`API key`).fill(providerCredential);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create provider` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
});

test(`loop providers tab supports assign remove and algorithm save`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Provider assignment loop ${Date.now()}`);
  const providerName = `Assignable provider ${Date.now()}`;

  await createProviderViaUi(page, providerName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);

  await expect(page.getByRole(`heading`, { name: `Assigned providers` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Assign provider` })).toBeVisible();
  await page.getByRole(`button`, { name: `Assign provider` }).click();
  await expect(page.locator(`#assign-provider-select`)).toBeVisible();
  await page.locator(`#assign-provider-select`).selectOption({ label: providerName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign` }).click();

  await expect(page.getByText(`Provider has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: providerName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `dev.user@canonical.com`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Selection algorithm` }).click();
  await expect(page.getByRole(`dialog`)).toBeVisible();
  await page.locator(`#loop-provider-selection-algorithm`).selectOption(`highest-credit-absolute`);
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Save algorithm` }).click();
  await expect(page.getByText(`Provider selection algorithm has been updated.`)).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${providerName}` }).click();
  await expect(page.getByText(`${providerName} has been removed from this loop.`)).toBeVisible();
});

test(`provider detail page renders expected fields`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Detail provider ${Date.now()}`;
  await createProviderViaUi(page, displayName);

  await page.getByRole(`link`, { name: displayName, exact: true }).click();

  await expect(page.getByRole(`heading`, { name: displayName })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Provider details` })).toBeVisible();
  await expect(page.getByText(`openrouter`, { exact: true })).toBeVisible();
  await expect(page.getByText(inferenceBaseUrl)).toBeVisible();
  await expect(page.getByText(`Credential configured`)).toBeVisible();
  await expect(page.getByText(`Chat capability`)).toBeVisible();
  await expect(page.getByText(`Embedding capability`)).toBeVisible();

  await page.getByRole(`link`, { name: `Settings` }).click();
  await expect(page.getByRole(`heading`, { name: `Model settings` })).toBeVisible();
});

test(`provider detail persists independent chat and embedding model settings`, async ({ page, testInference }) => {
  await authenticate(page);

  const inference = await testInference.setup(scenario().answersModelValidation(), { name: `working-provider` });
  const displayName = `Working provider ${Date.now()}`;

  await createProviderViaUi(page, displayName, inference.scope);
  await configureProviderModelsViaUi(page, displayName, `chat`, testInferenceChatModel);
  await configureProviderModelsViaUi(page, displayName, `embedding`, testInferenceEmbeddingModel);

  await page.reload();
  await expect(page.locator(`#provider-chat-enabled-model-${testInferenceChatModel}`)).toBeChecked();
  await expect(page.locator(`#provider-chat-default-model`)).toHaveValue(testInferenceChatModel);
  await expect(page.locator(`#provider-embedding-enabled-model-${testInferenceEmbeddingModel}`)).toBeChecked();
  await expect(page.locator(`#provider-embedding-default-model`)).toHaveValue(testInferenceEmbeddingModel);
});

test(`loop chat readiness ignores embedding-only providers`, async ({ page, testInference }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Capability-filtered loop ${Date.now()}`);
  const embeddingProviderName = `Embedding-only provider ${Date.now()}`;

  await createProviderViaUi(page, embeddingProviderName);
  await configureProviderModelsViaUi(page, embeddingProviderName, `embedding`, testInferenceEmbeddingModel);
  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);
  await page.getByRole(`button`, { name: `Assign provider` }).click();
  await page.locator(`#assign-provider-select`).selectOption({ label: embeddingProviderName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign` }).click();

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await expect(page.getByText(`No active chat-capable provider assignment is available for this loop.`)).toBeVisible();

  const inference = await testInference.setup(scenario().answersModelValidation(), { name: `chat-readiness-provider` });
  const chatProviderName = `Chat provider ${Date.now()}`;

  await createProviderViaUi(page, chatProviderName, inference.scope);
  await configureProviderModelsViaUi(page, chatProviderName, `chat`, testInferenceChatModel);
  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);
  await page.getByRole(`button`, { name: `Assign provider` }).click();
  await page.locator(`#assign-provider-select`).selectOption({ label: chatProviderName });
  await page.getByRole(`dialog`).getByRole(`button`, { name: `Assign` }).click();

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await expect(page.getByText(`No active chat-capable provider assignment is available for this loop.`)).toHaveCount(0);
});

test(`a provider that keeps failing is reported, and nothing is saved`, async ({ page, testInference }) => {
  await authenticate(page);

  const inference = await testInference.setup(scenario().failsModelValidation(`Upstream is unavailable.`), { name: `failing-provider` });
  const { scope } = inference;

  const displayName = `Failing provider ${Date.now()}`;
  await createProviderViaUi(page, displayName, scope);

  const href = await page.getByRole(`link`, { name: displayName, exact: true }).first().getAttribute(`href`);

  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.goto(`http://athena.localhost${href}/settings`);

  // Model listing does not use a scenario; the configured failure applies to model validation.
  await page.getByRole(`button`, { name: `Fetch models` }).click();
  await expect(page.locator(`#provider-chat-enabled-model-${testInferenceChatModel}`)).toBeVisible({ timeout: 20_000 });

  await page.locator(`#provider-chat-enabled-model-${testInferenceChatModel}`).check();
  await page.locator(`#provider-chat-default-model`).selectOption(testInferenceChatModel);
  await page.getByRole(`button`, { name: `Save model settings` }).click();

  // TestInferenceService returns 502 here, so Athena completes its retry sequence before reporting the failure.
  await expect(page.getByText(`Unable to save model settings`)).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.locator(`#provider-chat-default-model`)).toHaveValue(``);
});

test(`embedding authentication failure preserves the configured embedding model`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Embedding auth provider ${Date.now()}`;
  await createProviderViaUi(page, displayName);
  await configureProviderModelsViaUi(page, displayName, `embedding`, testInferenceEmbeddingModel);

  await page.goto(`http://athena.localhost/provider/list`);
  await page
    .getByRole(`button`, { name: `Edit ${displayName}` })
    .first()
    .click();
  await page.getByLabel(`API key (optional for rotation)`).fill(`invalid-embedding-credential`);
  await page.getByRole(`button`, { name: `Save provider` }).click();
  await expect(page.getByText(`${displayName} has been updated.`)).toBeVisible();

  await page.getByRole(`link`, { name: displayName, exact: true }).first().click();
  await page.getByRole(`link`, { name: `Settings` }).click();
  await expect(page.locator(`#provider-embedding-enabled-model-${testInferenceEmbeddingModel}`)).toBeChecked();
  await page.locator(`#provider-embedding-default-model`).selectOption(``);

  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.getByRole(`button`, { name: `Save model settings` }).click();
  await expect(page.getByText(`Unable to save model settings`)).toBeVisible();

  await page.reload();
  await expect(page.locator(`#provider-embedding-enabled-model-${testInferenceEmbeddingModel}`)).toBeChecked();
  await expect(page.locator(`#provider-embedding-default-model`)).toHaveValue(testInferenceEmbeddingModel);
});

test(`provider detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/provider/not-a-uuid`);

  await expect(page.getByText(`Unable to load provider`)).toBeVisible({ timeout: 5000 });
});

test(`provider list edit drawer shows not found message for unknown provider id`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/provider/list/edit/00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Provider not found`)).toBeVisible();
  await expect(page.getByText(`The selected provider no longer exists.`)).toBeVisible();
});
