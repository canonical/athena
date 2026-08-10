import { expect, type Page } from "./test.js";

export const dexEmail = `dev.user@canonical.com`;
export const dexLoopMemberEmail = `loop.member@canonical.com`;
const defaultDexPassword = process.env.APP_ATHENA_E2E_DEX_PASSWORD || `password`;

type DexCredentials = {
  email: string;
  password: string;
};

export const signInWithDex = async (page: Page, credentials: DexCredentials = { email: dexEmail, password: defaultDexPassword }) => {
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

  await loginInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  await page.locator(`button[type=submit], input[type=submit]`).first().click();
};

export const authenticate = async (page: Page, credentials: DexCredentials = { email: dexEmail, password: defaultDexPassword }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);
  await page.locator(`#main-content`).getByRole(`link`, { name: `Sign in` }).click();
  await signInWithDex(page, credentials);
  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
};
