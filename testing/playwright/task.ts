import { expect, type Page } from "@playwright/test";

export const turnTimeout = 60_000;

export const createTaskViaUi = async (page: Page, loopId: string) => {
  await page.goto(`http://athena.localhost/loop/${loopId}/task/list`);
  await page.getByRole(`button`, { name: `New Task` }).click();

  await expect(page.getByText(`Title: New Task`)).toBeVisible({ timeout: 20_000 });
};

export const sendTaskMessage = async (page: Page, message: string) => {
  await page.getByPlaceholder(`Write a message`).fill(message);
  await page.getByRole(`button`, { name: `Send` }).click();
};

export const openToolCallApproval = async (page: Page, toolLabel: string) => {
  await expect(page.getByText(toolLabel)).toBeVisible({ timeout: turnTimeout });
  await page.getByRole(`button`, { name: `Review & approve` }).click();

  await expect(page.getByRole(`button`, { name: `Approve`, exact: true })).toBeVisible();
};

export const approveToolCall = async (page: Page) => {
  await page.getByRole(`button`, { name: `Approve`, exact: true }).click();
};

export const rejectToolCall = async (page: Page, note: string) => {
  await page.locator(`#approval-message`).fill(note);
  await page.getByRole(`button`, { name: `Reject`, exact: true }).click();
};

export const rejectionNoteInHistory = (note: string): string => `Tool call rejected. User note: ${note}`;
