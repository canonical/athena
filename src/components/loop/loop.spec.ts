import { authenticate, expect, test } from "../../../testing/playwright/index.js";

test(`each loop run produces a distinct loop`, async ({ page }) => {
  await authenticate(page);

  const post = (workItemUrl: string) =>
    page.request.post(`http://athena.localhost/api/loop/events`, {
      data: {
        sourceType: `jira`,
        workItemUrl,
        requestedOutcome: `Distinct loop test`,
        payload: { issueKey: workItemUrl.split(`/`).at(-1), transition: `in-progress`, summary: `Distinct loop test` },
      },
    });

  const [r1, r2] = await Promise.all([post(`https://jira.example.com/browse/ATH-601`), post(`https://jira.example.com/browse/ATH-602`)]);

  const b1 = (await r1.json()) as { loop: { id: string } };
  const b2 = (await r2.json()) as { loop: { id: string } };

  expect(b1.loop.id).not.toBe(b2.loop.id);
});

test(`loop page shows events in the UI`, async ({ page }) => {
  await authenticate(page);

  await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-500`,
      requestedOutcome: `Visible in loop UI`,
      payload: {
        issueKey: `ATH-500`,
        transition: `in-progress`,
        summary: `Visible in loop UI`,
      },
    },
  });

  await page.goto(`http://athena.localhost/loop`);

  await expect(page.getByRole(`heading`, { name: `Loop events` })).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByText(`Completed`).first()).toBeVisible();
});
