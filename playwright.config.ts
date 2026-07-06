import { availableParallelism, cpus } from "node:os";
import { defineConfig } from "@playwright/test";

const workerCount = Math.max(1, availableParallelism ? availableParallelism() : cpus().length);

const config = defineConfig({
  testDir: `./src`,
  testMatch: [`**/*.spec.ts`],
  outputDir: `./testing/results/playwright`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: workerCount,
  reporter: `line`,
  timeout: 10_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://athena.localhost`,
    trace: `on-first-retry`,
  },
  globalSetup: `./testing/playwright-global-setup.ts`,
  globalTeardown: process.env.COVERAGE ? `./testing/playwright-coverage-teardown.ts` : undefined,
  projects: [
    {
      name: `athena`,
    },
  ],
});

export { config };

export default config;
