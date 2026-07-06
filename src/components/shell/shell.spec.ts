import { authenticate, expect, test } from "../../../testing/playwright/index.js";

test(`athena.localhost shows Hello from Athena`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/`);

  await expect(page.getByRole(`heading`, { name: `Hello from Athena` })).toBeVisible();
});
