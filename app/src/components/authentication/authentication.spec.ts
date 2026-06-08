import { expect, test } from "../../../testing/playwright/index.js";

const dexEmail = `dev.user@canonical.com`;
const dexPassword = `password`;

test(`authentication flow signs in through Dex`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.getByRole(`link`, { name: `Sign in` }).click();

  const loginInput = page.locator(`input[name=login], input[type=email]`).first();
  const passwordInput = page.locator(`input[name=password], input[type=password]`).first();

  // Dex may render either a provider chooser or the credential form directly.
  if (!(await loginInput.isVisible())) {
    const emailLoginAction = page.locator(`button:has-text("Log in with Email"), a:has-text("Log in with Email")`).first();
    await expect(emailLoginAction).toBeVisible();
    await emailLoginAction.click();
  }

  await expect(loginInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await loginInput.fill(dexEmail);
  await passwordInput.fill(dexPassword);
  await page.locator(`button[type=submit], input[type=submit]`).first().click();

  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);

  await page.goto(`http://athenabe.localhost/authentication/profile`);
  await expect(page.locator(`body`)).toContainText(`"isAuthenticated":true`);
  await expect(page.locator(`body`)).toContainText(dexEmail);
});
