import { defineConfig } from "@playwright/test";

const config = defineConfig({
  testDir: `./src`,
  testMatch: [`**/*.spec.ts`],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: `line`,
  timeout: 120_000,
  expect: {
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:8080`,
    trace: `on-first-retry`,
  },
  globalSetup: `./testing/playwright-global-setup.ts`,
  projects: [
    {
      name: `athena`,
    },
  ],
});

export { config };

export default config;