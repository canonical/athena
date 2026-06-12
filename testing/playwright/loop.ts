import type { Page } from "./test.js";
import { expect } from "./test.js";

export const createLoop = async (page: Page, name: string, description = `${name} description`) => {
  const response = await page.request.post(`http://athena.localhost/api/loops`, {
    data: {
      name,
      description,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string; description: string | null };
};
