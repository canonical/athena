import { expect, signInWithDex, test } from "../../../testing/playwright/index.js";

test(`authentication flow signs in through Dex`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.locator(`#main-content`).getByRole(`link`, { name: `Sign in` }).click();
  await signInWithDex(page);

  await page.goto(`http://athena.localhost/authentication`);
  await expect(page.getByRole(`heading`, { name: `You are authenticated` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Sign out` })).toBeVisible();
});

test(`sign out returns user to unauthenticated state`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);
  await page.locator(`#main-content`).getByRole(`link`, { name: `Sign in` }).click();
  await signInWithDex(page);

  await page.goto(`http://athena.localhost/authentication`);
  await page.getByRole(`button`, { name: `Sign out` }).click();

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});
