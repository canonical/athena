import type { Page } from "./test.js";
import { expect } from "./test.js";

export const createLoop = async (page: Page, name: string, description = `${name} description`) => {
  await page.goto(`http://athena.localhost/loop/list`);

  await page.getByRole(`button`, { name: `Create` }).click();
  await page.getByLabel(`Loop name`).fill(name);
  await page.getByLabel(`Loop description`).fill(description);
  await page.getByRole(`button`, { name: `Create loop` }).click();

  await expect(page.getByText(`${name} is ready to receive events.`)).toBeVisible();

  const loopLink = page.getByRole(`link`, { name, exact: true }).first();
  await expect(loopLink).toBeVisible();
  const href = await loopLink.getAttribute(`href`);

  const match = href?.match(/\/loop\/([^/?#]+)/);

  if (!match?.[1]) {
    throw new Error(`Unable to resolve loop id from created loop link.`);
  }

  return { id: match[1], name, description };
};
