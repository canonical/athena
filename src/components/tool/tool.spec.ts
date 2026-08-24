import { approveToolCall, callsTool, createTaskViaUi, expect, openToolCallApproval, rejectionNoteInHistory, rejectToolCall, replies, scenario, sendTaskMessage, test, turnTimeout } from "../../../testing/playwright/index.js";

const taskInstruction = `Give this task a title that describes it.`;
const titleTool = `athena_define_title`;
const titleToolLabel = `Define Task Title`;
const getTitleTool = `athena_get_title`;

test(`a tool call is gated on approval, then executed with the arguments the model chose`, async ({ page, runnableLoop, inference }) => {
  const chosenTitle = `Investigate flaky login`;

  await inference.mock(
    scenario()
      .whenToolOffered(titleTool, callsTool(titleTool, { title: chosenTitle }))
      .onceHistoryShows(chosenTitle, replies(`Recorded.`))
      .otherwise(replies(`Nothing to do.`)),
  );

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, taskInstruction);

  await openToolCallApproval(page, titleToolLabel);
  await expect(page.getByText(`Title: New Task`)).toBeVisible();

  await approveToolCall(page);
  await expect(page.getByText(`Title: ${chosenTitle}`)).toBeVisible({ timeout: turnTimeout });
});

test(`a tool that does not require approval executes automatically`, async ({ page, runnableLoop, inference }) => {
  const automaticReply = `The current task title is New Task.`;

  await inference.mock(scenario().whenToolOffered(getTitleTool, callsTool(getTitleTool, {})).onceHistoryShows(`"title": "New Task"`, replies(automaticReply)).otherwise(replies(`Nothing to do.`)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, `Read this task's current title.`);

  await expect(page.getByRole(`button`, { name: `Show tool call details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByRole(`button`, { name: `Show tool response details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(automaticReply)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByRole(`button`, { name: `Review & approve` })).toHaveCount(0);
  await expect(page.getByText(`Title: New Task`)).toBeVisible();
});

test(`a rejected tool call never runs, and the model is told`, async ({ page, runnableLoop, inference }) => {
  const refusedTitle = `Renamed without asking`;
  const rejectionNote = `Leave the title alone`;

  await inference.mock(
    scenario()
      .whenToolOffered(titleTool, callsTool(titleTool, { title: refusedTitle }))
      .onceHistoryShows(rejectionNoteInHistory(rejectionNote), replies(`Understood, leaving it as it is.`))
      .otherwise(replies(`Nothing to do.`)),
  );

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, taskInstruction);

  await openToolCallApproval(page, titleToolLabel);
  await rejectToolCall(page, rejectionNote);

  await expect(page.getByText(`Understood, leaving it as it is.`)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(`Title: New Task`)).toBeVisible();
  await expect(page.getByText(`Title: ${refusedTitle}`)).toHaveCount(0);
});

test(`a tool disabled for the loop is never offered, so the model cannot call it`, async ({ page, runnableLoop, inference }) => {
  const loopId = runnableLoop.loop.id;

  await inference.mock(
    scenario()
      .whenToolOffered(titleTool, callsTool(titleTool, { title: `Never set` }))
      // A different tool call proves inference ran after the title tool was disabled.
      .otherwise(callsTool(`athena_define_objective`, { objective: `Establish the cause.` })),
  );

  await page.goto(`http://athena.localhost/loop/${loopId}/tools`);

  const toolRow = page.getByRole(`row`, { name: new RegExp(titleTool) });
  await expect(toolRow.getByRole(`button`, { name: `Disable` })).toBeVisible({ timeout: 20_000 });
  await toolRow.getByRole(`button`, { name: `Disable` }).click();

  await expect(toolRow.getByRole(`button`, { name: `Enable` })).toBeVisible({ timeout: 20_000 });

  await createTaskViaUi(page, loopId);
  await sendTaskMessage(page, taskInstruction);

  await expect(page.getByText(`Define Task Objective`)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(titleToolLabel)).toHaveCount(0);
  await expect(page.getByText(`Title: New Task`)).toBeVisible();
});
