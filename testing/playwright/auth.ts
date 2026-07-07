import { expect, type Page } from "./test.js";

export const dexEmail = `dev.user@canonical.com`;
const dexPassword = process.env.APP_ATHENA_E2E_DEX_PASSWORD || `password`;

export const signInWithDex = async (page: Page) => {
  const athenaSignInLink = page.locator(`#main-content`).getByRole(`link`, { name: `Sign in` }).first();

  if (await athenaSignInLink.isVisible()) {
    await athenaSignInLink.click();
  }

  const loginInput = page.locator(`input[name=login], input[type=email]`).first();
  const passwordInput = page.locator(`input[name=password], input[type=password]`).first();
  const emailLoginAction = page.locator(`button:has-text("Log in with Email"), a:has-text("Log in with Email"), button:has-text("Log in with email"), a:has-text("Log in with email")`).first();

  await expect(loginInput.or(emailLoginAction)).toBeVisible();

  if (await emailLoginAction.isVisible()) {
    await emailLoginAction.click();
  }

  await expect(loginInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await loginInput.fill(dexEmail);
  await passwordInput.fill(dexPassword);
  await page.locator(`button[type=submit], input[type=submit]`).first().click();
};

export const authenticate = async (page: Page) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);
  await page.locator(`#main-content`).getByRole(`link`, { name: `Sign in` }).click();
  await signInWithDex(page);
  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
};
