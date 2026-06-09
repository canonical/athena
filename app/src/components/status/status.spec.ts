import { expect, test } from "../../../testing/playwright/index.js";

const statusEndpoints = [`/_status/check`, `/_status/ping`];

for (const endpoint of statusEndpoints) {
  test(`${endpoint} is publicly accessible`, async ({ request }) => {
    const response = await request.get(`http://athenabe.localhost${endpoint}`);

    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({
      status: `ok`,
      whoami: `athena`,
    });
  });
}
