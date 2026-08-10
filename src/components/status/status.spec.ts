import { authenticate, expect, test } from "../../../testing/playwright/index.js";

test(`application root renders the shell`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/`);

  await expect(page.getByRole(`button`, { name: `Create` })).toBeVisible();
});
