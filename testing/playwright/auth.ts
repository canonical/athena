import { expect, type Page } from "./test.js";

export const dexEmail = `dev.user@canonical.com`;
export const dexLoopMemberEmail = `loop.member@canonical.com`;
const defaultDexPassword = process.env.APP_ATHENA_E2E_DEX_PASSWORD || `password`;

type DexCredentials = {
  email: string;
  password: string;
};

export const signInWithDex = async (page: Page, credentials: DexCredentials = { email: dexEmail, password: defaultDexPassword }) => {
  const loginInput = page.locator(`input[name=login], input[type=email]`).first();
  const passwordInput = page.locator(`input[name=password], input[type=password]`).first();
  const emailLoginAction = page.locator(`button:has-text("Log in with Email"), a:has-text("Log in with Email"), button:has-text("Log in with email"), a:has-text("Log in with email")`).first();
  const athenaSignInHeading = page.getByRole(`heading`, { name: `Sign in to Athena` }).first();
  const oidcLoginLink = page.locator(`#main-content a[href*="/api/authentication/login"]`).first();

  const isDexLoginVisible = async (): Promise<boolean> => {
    if (await loginInput.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    if (await emailLoginAction.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    return false;
  };

  if (!(await isDexLoginVisible())) {
    await expect(athenaSignInHeading).toBeVisible({ timeout: 8_000 });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(oidcLoginLink).toBeVisible({ timeout: 5_000 });
      await oidcLoginLink.click();

      if (await isDexLoginVisible()) {
        break;
      }

      if (!(await athenaSignInHeading.isVisible({ timeout: 2_000 }).catch(() => false))) {
        break;
      }
    }
  }

  await expect(loginInput.or(emailLoginAction)).toBeVisible({ timeout: 8_000 });

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

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`http://athena.localhost/authentication`, { waitUntil: `domcontentloaded` });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !error.message.includes(`net::ERR_ABORTED`) || attempt === 2) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  await signInWithDex(page, credentials);
  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
};
