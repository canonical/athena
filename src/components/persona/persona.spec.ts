import { authenticate, createLoop, expect, type Page, test } from "../../../testing/playwright/index.js";

const openPersonaList = async (page: Page) => {
  await page.goto(`http://athena.localhost/persona/list`);
  await expect(page.getByRole(`heading`, { name: `Personas`, exact: true })).toBeVisible();
};

test(`persona list requires authentication`, async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/persona/list`);

  await expect(page.getByRole(`heading`, { name: `Sign in to Athena` })).toBeVisible();
});

test(`persona list page supports creating and editing a persona with role`, async ({ page }) => {
  await authenticate(page);
  await openPersonaList(page);

  const displayName = `Global IC ${Date.now()}`;
  const updatedDisplayName = `${displayName} updated`;

  await page.getByRole(`button`, { name: `Create persona` }).click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Role`).fill(`Senior IC`);
  await page.getByLabel(`Personality`).fill(`You are a global IC persona.`);
  await page.getByRole(`button`, { name: `Add persona` }).click();

  await expect(page.getByText(`${displayName} has been created.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Senior IC`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Edit ${displayName}` }).click();
  await page.getByLabel(`Display name`).fill(updatedDisplayName);
  await page.getByLabel(`Role`).fill(`Principal IC`);
  await page.getByRole(`button`, { name: `Save persona` }).click();

  await expect(page.getByText(`${updatedDisplayName} has been updated.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: updatedDisplayName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Principal IC`, exact: true }).first()).toBeVisible();
});

test(`loop personas tab shows role and supports add and remove`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Loop personas flow ${Date.now()}`);
  const displayName = `Loop IC ${Date.now()}`;

  await openPersonaList(page);
  await page.getByRole(`button`, { name: `Create persona` }).click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Role`).fill(`Staff IC`);
  await page.getByLabel(`Personality`).fill(`You are a loop persona.`);
  await page.getByRole(`button`, { name: `Add persona` }).click();
  await expect(page.getByText(`${displayName} has been created.`)).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}?tab=personas`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  await page.getByLabel(`Persona`).selectOption({ label: displayName });
  await page.getByRole(`button`, { name: `Assign persona` }).click();

  await expect(page.getByText(`Persona has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Staff IC`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${displayName}` }).click();
  await expect(page.getByText(`${displayName} has been removed from this loop.`)).toBeVisible();
});

test(`persona detail page supports assign to loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Persona detail assignment loop ${Date.now()}`);
  const displayName = `Detail assign IC ${Date.now()}`;

  await openPersonaList(page);
  await page.getByRole(`button`, { name: `Create persona` }).click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Role`).fill(`Engineer`);
  await page.getByLabel(`Personality`).fill(`A persona assigned from detail view.`);
  await page.getByRole(`button`, { name: `Add persona` }).click();

  await page.getByRole(`link`, { name: displayName, exact: true }).first().click();
  await expect(page.getByText(`Persona details`)).toBeVisible();
  await expect(page.getByRole(`heading`, { name: `Assign to loop` })).toBeVisible();

  await page.getByLabel(`Loop`).selectOption({ label: loop.name });
  await page.getByRole(`button`, { name: `Assign to loop` }).click();

  await expect(page.getByText(`has been assigned to ${loop.name}`)).toBeVisible();
});

test(`persona list supports clone and edit flow for non-owned personas`, async ({ page }) => {
  await authenticate(page);
  await openPersonaList(page);

  const cloneButton = page.getByRole(`button`, { name: /Clone & Edit / }).first();
  await expect(cloneButton).toBeVisible();

  await cloneButton.click();
  await expect(page.getByRole(`dialog`).getByRole(`button`, { name: `Clone persona` })).toBeVisible();

  const clonedName = `Cloned persona ${Date.now()}`;
  await page.getByLabel(`Display name`).fill(clonedName);
  await page.getByRole(`button`, { name: `Clone persona` }).click();

  await expect(page.getByText(`${clonedName} has been created.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: clonedName, exact: true }).first()).toBeVisible();
});

test(`persona list edit drawer shows not found message for unknown persona id`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/persona/list?edit=00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Persona not found`)).toBeVisible();
  await expect(page.getByText(`The selected persona no longer exists.`)).toBeVisible();
});
