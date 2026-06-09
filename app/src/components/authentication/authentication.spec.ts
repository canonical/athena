import { expect, type Page, test } from "../../../testing/playwright/index.js";

const dexEmail = `dev.user@canonical.com`;
const dexPassword = `password`;

const decodeSessionCookie = (value: string): Record<string, unknown> => JSON.parse(globalThis.atob(decodeURIComponent(value))) as Record<string, unknown>;

test.describe.configure({ mode: `serial` });

const getSessionCookiePayload = async (page: Page, origin: string): Promise<Record<string, unknown> | undefined> => {
  const sessionCookie = (await page.context().cookies(origin)).find((cookie) => cookie.name === `session`);

  return sessionCookie ? decodeSessionCookie(sessionCookie.value) : undefined;
};

const expectFrontendSessionCookieToOnlyContainId = async (page: Page) => {
  const sessionPayload = await getSessionCookiePayload(page, `http://athena.localhost`);

  if (!sessionPayload) {
    return;
  }

  expect(Object.keys(sessionPayload)).toEqual([`id`]);
};

const expectBackendSessionCookieToExcludeSensitiveData = async (page: Page) => {
  const sessionPayload = await getSessionCookiePayload(page, `http://athenabe.localhost`);

  if (!sessionPayload) {
    return;
  }

  expect(sessionPayload).not.toHaveProperty(`user`);
  expect(sessionPayload).not.toHaveProperty(`idToken`);
  expect(sessionPayload).not.toHaveProperty(`accessToken`);
  expect(sessionPayload).not.toHaveProperty(`refreshToken`);
};

const signInWithDex = async (page: Page) => {
  const loginInput = page.locator(`input[name=login], input[type=email]`).first();
  const passwordInput = page.locator(`input[name=password], input[type=password]`).first();
  const emailLoginAction = page.locator(`button:has-text("Log in with Email"), a:has-text("Log in with Email")`).first();

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

test(`authentication flow signs in through Dex`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.getByRole(`link`, { name: `Sign in` }).click();
  await expectFrontendSessionCookieToOnlyContainId(page);
  await expectBackendSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
  await expectFrontendSessionCookieToOnlyContainId(page);

  await page.goto(`http://athenabe.localhost/authentication/profile`);
  const profile = JSON.parse(await page.locator(`body`).innerText()) as { isAuthenticated: boolean; user: Record<string, unknown> | null };
  expect(profile.isAuthenticated).toBe(true);
  expect(profile.user).toMatchObject({ id: dexEmail, email: dexEmail });
  expect(profile.user).not.toHaveProperty(`idToken`);
  expect(profile.user).not.toHaveProperty(`accessToken`);

  const sessionCookie = (await page.context().cookies(`http://athenabe.localhost`)).find((cookie) => cookie.name === `session`);
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);

  const sessionPayload = decodeSessionCookie(sessionCookie?.value ?? ``);
  expect(Object.keys(sessionPayload)).toEqual([`id`]);
  expect(sessionPayload.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
  expect(sessionPayload).not.toHaveProperty(`user`);
  expect(sessionPayload).not.toHaveProperty(`idToken`);
  expect(sessionPayload).not.toHaveProperty(`accessToken`);
});

test(`authentication ignores external returnTo values`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athenabe.localhost/authentication/login?returnTo=https://attacker.example/path`);
  await expectFrontendSessionCookieToOnlyContainId(page);
  await expectBackendSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/?$/);
});

test(`logout clears the Athena session without starting a new sign-in`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.getByRole(`link`, { name: `Sign in` }).click();
  await expectFrontendSessionCookieToOnlyContainId(page);
  await expectBackendSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);

  await page.goto(`http://athenabe.localhost/authentication/logout`);

  await expect(page).toHaveURL(/athena\.localhost\/?$/);

  const sessionCookie = (await page.context().cookies(`http://athenabe.localhost`)).find((cookie) => cookie.name === `session`);
  expect(sessionCookie).toBeUndefined();

  await page.goto(`http://athenabe.localhost/authentication/profile`);
  const profile = JSON.parse(await page.locator(`body`).innerText()) as { isAuthenticated: boolean; user: Record<string, unknown> | null };
  expect(profile).toEqual({ isAuthenticated: false, user: null });
});
