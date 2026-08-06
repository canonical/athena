import { authenticate, expect, test } from "../../../testing/playwright/index.js";

test(`athena.localhost shows the loop list`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/`);

  await expect(page.getByRole(`button`, { name: `Create` })).toBeVisible();
});

test(`athena.localhost no longer exposes loop list route`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/list`);

  await expect(page.getByText(`Page not found`)).toBeVisible();
});
