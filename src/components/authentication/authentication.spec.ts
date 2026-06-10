import { dexEmail, expect, type Page, signInWithDex, test } from "../../../testing/playwright/index.js";

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

const expectApiSessionCookieToExcludeSensitiveData = async (page: Page) => {
  const sessionPayload = await getSessionCookiePayload(page, `http://athena.localhost`);

  if (!sessionPayload) {
    return;
  }

  expect(sessionPayload).not.toHaveProperty(`user`);
  expect(sessionPayload).not.toHaveProperty(`idToken`);
  expect(sessionPayload).not.toHaveProperty(`accessToken`);
  expect(sessionPayload).not.toHaveProperty(`refreshToken`);
};

test(`authentication flow signs in through Dex`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.getByRole(`link`, { name: `Sign in` }).click();
  await expectApiSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
  await expectFrontendSessionCookieToOnlyContainId(page);

  await page.goto(`http://athena.localhost/api/authentication/profile`);
  const profile = JSON.parse(await page.locator(`body`).innerText()) as { isAuthenticated: boolean; user: Record<string, unknown> | null };
  expect(profile.isAuthenticated).toBe(true);
  expect(profile.user).toMatchObject({ id: dexEmail, email: dexEmail });
  expect(profile.user).not.toHaveProperty(`idToken`);
  expect(profile.user).not.toHaveProperty(`accessToken`);

  const sessionCookie = (await page.context().cookies(`http://athena.localhost`)).find((cookie) => cookie.name === `session`);
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);

  const sessionPayload = decodeSessionCookie(sessionCookie?.value ?? ``);
  expect(Object.keys(sessionPayload)).toEqual([`id`]);
  expect(sessionPayload.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
  expect(sessionPayload).not.toHaveProperty(`user`);
  expect(sessionPayload).not.toHaveProperty(`idToken`);
  expect(sessionPayload).not.toHaveProperty(`accessToken`);
});

test(`authentication page shows authenticated state after sign-in`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
  await page.getByRole(`link`, { name: `Sign in` }).click();
  await expectApiSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await page.goto(`http://athena.localhost/authentication`);
  await expect(page.getByRole(`heading`, { name: `You are authenticated` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Sign out` })).toBeVisible();
});

test(`authentication ignores external returnTo values`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/api/authentication/login?returnTo=https://attacker.example/path`);
  await expectApiSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/?$/);
});

test(`authentication resolves relative returnTo values on the frontend host`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/api/authentication/login?returnTo=/authentication`);
  await expectApiSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/authentication$/);
});

test(`logout clears the Athena session without starting a new sign-in`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/api/authentication/login?returnTo=/authentication`);
  await expectApiSessionCookieToExcludeSensitiveData(page);
  await signInWithDex(page);

  await expect(page).toHaveURL(/athena\.localhost\/authentication$/);
  const logoutResponse = await page.request.post(`http://athena.localhost/api/authentication/logout`, {
    headers: { origin: `http://athena.localhost` },
  });
  expect(logoutResponse.status()).toBe(204);

  const sessionCookie = (await page.context().cookies(`http://athena.localhost`)).find((cookie) => cookie.name === `session`);
  expect(sessionCookie).toBeUndefined();

  await page.goto(`http://athena.localhost/api/authentication/profile`);
  const profile = JSON.parse(await page.locator(`body`).innerText()) as { isAuthenticated: boolean; user: Record<string, unknown> | null };
  expect(profile).toEqual({ isAuthenticated: false, user: null });
});
