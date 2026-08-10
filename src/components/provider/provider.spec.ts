import { authenticate, createLoop, expect, type Page, test } from "../../../testing/playwright/index.js";

const openProviderList = async (page: Page) => {
  await page.goto(`http://athena.localhost/provider/list`);
  await expect(page.getByRole(`button`, { name: `Create provider` })).toBeVisible();
};

const createProviderViaUi = async (page: Page, displayName: string) => {
  await openProviderList(page);

  await page.getByRole(`button`, { name: `Create provider` }).first().click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Base URL`).fill(`https://openrouter.ai/api/v1`);
  await page.getByLabel(`API key`).fill(`openrouter-${Date.now()}`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create provider` }).click();

  await expect(page.getByText(`${displayName} is available for loop assignment.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
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

test(`provider editor validates HTTPS base URL`, async ({ page }) => {
  await authenticate(page);
  await openProviderList(page);

  await page.getByRole(`button`, { name: `Create provider` }).first().click();
  await page.getByLabel(`Display name`).fill(`Invalid URL provider ${Date.now()}`);
  await page.getByLabel(`Base URL`).fill(`http://openrouter.ai/api/v1`);
  await page.getByLabel(`API key`).fill(`invalid-base-url-key`);
  await page.locator(`form`).first().getByRole(`button`, { name: `Create provider` }).click();

  await expect(page.getByText(`baseUrl must use HTTPS.`)).toBeVisible();
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
  await expect(page.getByText(`https://openrouter.ai/api/v1`)).toBeVisible();
  await expect(page.getByText(`Credential configured`)).toBeVisible();

  // Navigate to settings tab to verify Model settings
  await page.getByRole(`link`, { name: `Settings` }).click();
  await expect(page.getByRole(`heading`, { name: `Model settings` })).toBeVisible();
});

test(`provider detail supports enabled models and default model persistence`, async ({ page }) => {
  await authenticate(page);

  const displayName = `Model settings provider ${Date.now()}`;
  await createProviderViaUi(page, displayName);

  // Get settings URL from the provider link
  const providerLink = page.getByRole(`link`, { name: displayName, exact: true }).first();
  const href = await providerLink.getAttribute(`href`);

  // Mock models GET endpoint
  await page.route(`**/provider/*/models`, async (route) => {
    if (route.request().method() !== `GET`) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: `application/json`,
      body: JSON.stringify({
        models: [
          { id: `openai/gpt-4.1-mini`, displayName: `GPT-4.1 Mini` },
          { id: `openai/gpt-4.1`, displayName: `GPT-4.1` },
          { id: `anthropic/claude-3.7-sonnet`, displayName: `Claude 3.7 Sonnet` },
        ],
      }),
    });
  });

  // Mock models validate endpoint (return all as available)
  await page.route(`**/provider/*/models/validate`, async (route) => {
    const body = (await route.request().postDataJSON()) as { models: string[] };
    await route.fulfill({
      status: 200,
      contentType: `application/json`,
      body: JSON.stringify({ results: body.models.map((model: string) => ({ model, available: true })) }),
    });
  });

  // Accept window.confirm dialog for the model validation step
  page.on(`dialog`, (dialog) => void dialog.accept());

  await page.goto(`http://athena.localhost${href}/settings`);

  await expect(page.getByRole(`button`, { name: `Fetch models` })).toBeVisible({ timeout: 5000 });
  await page.getByRole(`button`, { name: `Fetch models` }).click();
  await expect(page.getByRole(`checkbox`, { name: `GPT-4.1 Mini` })).toBeVisible();

  await page.getByRole(`checkbox`, { name: `Claude 3.7 Sonnet` }).uncheck();
  await page.getByLabel(`Default model`).selectOption(`openai/gpt-4.1`);
  await page.getByRole(`button`, { name: `Save model settings` }).click();

  await expect(page.getByText(`Provider model settings have been updated.`)).toBeVisible();
  await expect(page.getByLabel(`Default model`)).toHaveValue(`openai/gpt-4.1`);
  await expect(page.getByRole(`checkbox`, { name: `Claude 3.7 Sonnet` })).not.toBeChecked();
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
