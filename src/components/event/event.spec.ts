import { authenticate, expect, test } from "../../../testing/playwright/index.js";

test(`events page requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/event/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`events page renders for authenticated users`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/event/list`);

  await expect(page.getByRole(`heading`, { name: `Events` })).toBeVisible();
});
