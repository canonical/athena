import { createTaskViaUi, expect, replies, scenario, sendTaskMessage, test, turnTimeout } from "../../../testing/playwright/index.js";

test(`the model's reply to a message is shown in the conversation`, async ({ page, runnableLoop, inference }) => {
  const question = `Which part of the login flow should we check first?`;
  const answer = `Check the session cookie before anything else.`;

  await inference.mock(scenario().whenConversationMentions(question, replies(answer)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, question);

  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByText(answer)).toBeVisible({ timeout: turnTimeout });
});
