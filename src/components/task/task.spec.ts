import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

test("tasks view shows task history and new task button", async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop with tasks view ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}`);
  await expect(page.getByRole("heading", { name: loop.name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tasks" })).toHaveAttribute("aria-selected", "true");

  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Task" })).toBeVisible();
});

test("new task button keeps task composer available", async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop task composer test ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await expect(page.getByRole("button", { name: "New Task" })).toBeVisible();

  await page.getByRole("button", { name: "New Task" }).click();

  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark Chat Complete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark Task Complete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark Blocked" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Update Context" })).toBeDisabled();
  await expect(page.getByLabel("Lifecycle note (optional)")).toBeVisible();
  await expect(page.getByLabel("Blocker reason (required for Mark Blocked)")).toBeVisible();
});

test("task inspector shows routed target type and resolved target fields", async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop routing target fields ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);

  await expect(page.getByText(`Routed target type:`, { exact: false })).toHaveCount(0);
  await expect(page.getByText(`Routing context mode:`, { exact: false })).toHaveCount(0);

  await page.getByRole("button", { name: "New Task" }).click();
  await page.getByLabel("Message").fill("Prepare implementation plan for this loop.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(`Routing context mode:`, { exact: false })).toBeVisible();
  await expect(page.getByText(`Routed target type:`, { exact: false })).toBeVisible();
  await expect(page.getByText(`Resolved target:`, { exact: false })).toBeVisible();
});

test("send queues routing decision immediately when in routing phase", async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop queued task routing ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await page.getByRole("button", { name: "New Task" }).click();

  const responsePromise = page.waitForResponse((response) => response.request().method() === `POST` && response.url().includes(`/api/task/loop`));

  await page.getByLabel("Message").fill("Prepare implementation plan for this loop.");
  await page.getByRole("button", { name: "Send" }).click();

  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as { tasks?: Array<{ phase?: string; status?: string }> };
  expect(payload.tasks?.[0]?.phase).toBe(`routing`);
  expect(payload.tasks?.[0]?.status).toBe(`active`);
});

test("task inspector displays autonomy iteration metadata", async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Loop autonomy metadata ${Date.now()}`);

  await page.goto(`http://athena.localhost/loop/${loop.id}/task/list`);
  await page.getByRole("button", { name: "New Task" }).click();

  await page.getByLabel("Message").fill("Analyze this requirement and suggest an approach.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/Autonomy iterations:\s*\d+\s*\/\s*\d+/)).toBeVisible();
});
