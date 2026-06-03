import { expect, test } from "../testing/playwright/index.js";

test(`status endpoint returns Athena identity`, async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/_status/check`);

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({
    status: `ok`,
    whoami: `athena`,
  });
});
