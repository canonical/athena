import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test(`loop list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/loop/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`loops page supports create update and delete`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/list`);

  await expect(page.getByRole(`button`, { name: `Create` })).toBeVisible();
  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(`UI loop`);
  await page.getByLabel(`Loop description`).fill(`Loop created through the UI`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`UI loop is ready to receive events.`)).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop`, exact: true }).first()).toBeVisible();

  await page
    .getByRole(`row`, { name: /UI loop/ })
    .getByRole(`button`, { name: `Edit` })
    .click();
  await page.getByLabel(`Loop name`).first().fill(`UI loop updated`);
  await page.getByLabel(`Loop description`).first().fill(`Updated through the UI`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`UI loop updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true }).first()).toBeVisible();

  await page
    .getByRole(`row`, { name: /UI loop updated/ })
    .getByRole(`button`, { name: `Delete` })
    .click();

  await expect(page.getByText(`UI loop updated has been deleted.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `UI loop updated`, exact: true })).toHaveCount(0);
});

test(`loop list allows navigating to loop detail page`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/list`);

  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(`Navigation test loop`);
  await page.getByLabel(`Loop description`).fill(`Loop for navigation test`);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`Navigation test loop is ready to receive events.`)).toBeVisible();

  await page.getByRole(`link`, { name: `Navigation test loop` }).click();

  await expect(page.getByRole(`heading`, { name: `Navigation test loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Details` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Providers` })).toBeVisible();
});

test(`loop detail page tabs are deep-linkable`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Deep link tab loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=personas`);

  await expect(page.getByRole(`heading`, { name: `Deep link tab loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Personas` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=providers`);
  await expect(page.getByRole(`tab`, { name: `Providers` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Assigned providers` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Provider selection algorithm` })).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Assign an existing provider` })).toBeVisible();
});

test(`providers tab keeps assign-provider section visible even when provider list is empty`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Providers tab visibility loop`);

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=providers`);

  await expect(page.getByRole(`heading`, { name: `Assign an existing provider` })).toBeVisible();
});

test(`loop detail page saves loop details from the Details tab`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Detail save loop`, `Original description`);
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  await expect(page.getByRole(`tab`, { name: `Details` })).toHaveAttribute(`aria-selected`, `true`);
  await page.getByRole(`button`, { name: `Edit loop` }).click();
  await page.getByLabel(`Loop name`).fill(`Detail save loop updated`);
  await page.getByRole(`button`, { name: `Save loop` }).click();

  await expect(page.getByText(`Detail save loop updated has been updated.`)).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Detail save loop updated` })).toBeVisible();
});

test(`loop details tab shows no paused banner for a properly configured loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Paused routing loop`);

  // Navigate directly to the Details tab without visiting the Personas tab first.
  // The persona list is fetched at the Loop level so the routing count is available on any tab.
  await page.goto(`http://athena.localhost/loop/${loop.id}`);

  await expect(page.getByRole(`heading`, { name: `Paused routing loop` })).toBeVisible();
  await expect(page.getByRole(`tab`, { name: `Details` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByText(`Loop is paused`)).toHaveCount(0);
});

test(`loop detail with invalid id shows an error notification`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/loop/not-a-uuid`);

  await expect(page.getByText(`Unable to load loop`)).toBeVisible();
  await expect(page.getByText(`loopId must be a valid UUID.`)).toBeVisible();
});
