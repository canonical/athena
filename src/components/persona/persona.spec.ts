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

  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  await page.getByLabel(`Persona`).selectOption({ label: displayName });
  await page.getByRole(`button`, { name: `Assign persona` }).click();

  await expect(page.getByText(`Persona has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: displayName, exact: true }).first()).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: `Staff IC`, exact: true }).first()).toBeVisible();

  await page.getByRole(`button`, { name: `Remove ${displayName}` }).click();
  await expect(page.getByText(`${displayName} has been removed from this loop.`)).toBeVisible();
});

test(`loop personas tab can assign catalog personas to loop`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Loop catalog personas flow ${Date.now()}`);

  // Navigate to loop personas tab
  await page.goto(`http://athena.localhost/loop/${loop.id}/personas`);
  await expect(page.getByRole(`heading`, { name: `Assigned personas` })).toBeVisible();

  // Open assign drawer
  await page.getByRole(`button`, { name: `Assign persona` }).click();

  // Get the persona dropdown and select first option (should be from catalog since no owned personas assigned)
  const personaOptions = await page.locator(`#assign-persona-select option`).count();
  if (personaOptions <= 1) {
    throw new Error(`No personas available to assign (only placeholder option found)`);
  }

  // Select first available persona from dropdown
  const personaSelect = page.getByLabel(`Persona`);
  const options = await personaSelect.locator(`option`).allTextContents();
  const firstPersonaLabel = options.find((opt) => opt !== `— Select a persona —`);

  if (!firstPersonaLabel) {
    throw new Error(`No personas found in dropdown`);
  }

  await personaSelect.selectOption({ label: firstPersonaLabel });
  await page.getByRole(`button`, { name: `Assign` }).click();

  // Verify success
  await expect(page.getByText(`Persona has been assigned to this loop.`)).toBeVisible();
  await expect(page.getByRole(`gridcell`, { name: firstPersonaLabel, exact: true }).first()).toBeVisible();
});

test(`persona list shows edit actions for owned personas only`, async ({ page }) => {
  await authenticate(page);
  await openPersonaList(page);

  const displayName = `Owned IC ${Date.now()}`;
  await page.getByRole(`button`, { name: `Create persona` }).click();
  await page.getByLabel(`Display name`).fill(displayName);
  await page.getByLabel(`Role`).fill(`Engineer`);
  await page.getByLabel(`Personality`).fill(`Owned persona for list filtering check.`);
  await page.getByRole(`button`, { name: `Add persona` }).click();

  await expect(page.getByText(`${displayName} has been created.`)).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Edit ${displayName}` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: /Clone & Edit / })).toHaveCount(0);
});

test(`persona list edit drawer shows not found message for unknown persona id`, async ({ page }) => {
  await authenticate(page);
  await page.goto(`http://athena.localhost/persona/list?edit=00000000-0000-4000-8000-000000000000`);

  await expect(page.getByText(`Persona not found`)).toBeVisible();
  await expect(page.getByText(`The selected persona no longer exists.`)).toBeVisible();
});

test(`persona list has two tabs: My Personas and Persona Catalog with deep linking`, async ({ page }) => {
  await authenticate(page);
  await openPersonaList(page);

  // Verify default tab is "My Personas"
  await expect(page.getByRole(`tab`, { name: `My Personas` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `My Personas` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Create persona` })).toBeVisible();

  // Navigate to Persona Catalog tab
  await page.getByRole(`tab`, { name: `Persona Catalog` }).click();
  await expect(page.getByRole(`tab`, { name: `Persona Catalog` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Persona Catalog` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Create persona` })).not.toBeVisible();

  // Test deep linking to Persona Catalog tab
  await page.goto(`http://athena.localhost/persona/list/catalog`);
  await expect(page.getByRole(`tab`, { name: `Persona Catalog` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `Persona Catalog` })).toBeVisible();

  // Test deep linking to My Personas tab
  await page.goto(`http://athena.localhost/persona/list`);
  await expect(page.getByRole(`tab`, { name: `My Personas` })).toHaveAttribute(`aria-selected`, `true`);
  await expect(page.getByRole(`heading`, { name: `My Personas` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Create persona` })).toBeVisible();
});

test(`persona catalog allows cloning a persona with name only`, async ({ page }) => {
  await authenticate(page);
  await openPersonaList(page);

  // Navigate to Persona Catalog tab
  await page.getByRole(`tab`, { name: `Persona Catalog` }).click();
  await expect(page.getByRole(`heading`, { name: `Persona Catalog` })).toBeVisible();

  // Get first persona name from the catalog
  const firstPersonaLink = page.locator(`a`).first();
  const personaName = await firstPersonaLink.textContent();
  if (!personaName) {
    throw new Error(`No personas in catalog`);
  }

  // Click Clone button for first persona
  await page.getByRole(`button`, { name: new RegExp(`Clone ${personaName.split(`(`)[0].trim()}`) }).click();

  // Fill in clone name
  const clonedName = `${personaName.split(`(`)[0].trim()} Clone ${Date.now()}`;
  await page.getByLabel(`Persona name`).fill(clonedName);

  // Submit clone form
  await page.getByRole(`button`, { name: `Clone` }).click();

  // Verify success notification
  await expect(page.getByText(`Persona cloned`)).toBeVisible();
  await expect(page.getByText(`${clonedName} has been created.`)).toBeVisible();

  // Verify switched to My Personas tab
  await expect(page.getByRole(`tab`, { name: `My Personas` })).toHaveAttribute(`aria-selected`, `true`);

  // Verify cloned persona appears in the list
  await expect(page.getByRole(`link`, { name: clonedName })).toBeVisible();
});
