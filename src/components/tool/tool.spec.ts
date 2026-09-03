import {
  approveToolCall,
  authenticate,
  callsTool,
  createLoop,
  createTaskViaUi,
  expect,
  openToolCallApproval,
  rejectionNoteInHistory,
  rejectToolCall,
  replies,
  scenario,
  sendTaskMessage,
  test,
  turnTimeout,
} from "../../../testing/playwright/index.js";

const taskInstruction = `Give this task a title that describes it.`;
const titleTool = `athena_define_title`;
const titleToolLabel = `Define Task Title`;
const getTitleTool = `athena_get_title`;

test(`the loop tools page shows which tools require approval`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Tool metadata loop ${Date.now()}`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/tools`);

  const approvalColumn = 3;
  const createItemRow = page.getByRole(`row`, { name: /workgraph_create_item/ });
  const readItemRow = page.getByRole(`row`, { name: /workgraph_read_item/ });

  await expect(createItemRow).toBeVisible({ timeout: 20_000 });
  await expect(createItemRow.getByRole(`gridcell`).nth(approvalColumn)).toHaveText(`Yes`);
  await expect(readItemRow.getByRole(`gridcell`).nth(approvalColumn)).toHaveText(`No`);
});

test(`a tool call is gated on approval, then executed with the arguments the model chose`, async ({ page, runnableLoop, inference }) => {
  const chosenTitle = `Investigate flaky login`;

  await inference.mock(scenario().answers(taskInstruction, callsTool(titleTool, { title: chosenTitle }), replies(`Recorded.`)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, taskInstruction);

  await openToolCallApproval(page, titleToolLabel);
  await expect(page.getByText(`Title: New Task`)).toBeVisible();

  await approveToolCall(page);
  await expect(page.getByText(`Title: ${chosenTitle}`)).toBeVisible({ timeout: turnTimeout });
});

test(`a tool that does not require approval executes automatically`, async ({ page, runnableLoop, inference }) => {
  const automaticReply = `The current task title is New Task.`;
  const readTitleInstruction = `Read this task's current title.`;

  await inference.mock(scenario().answers(readTitleInstruction, callsTool(getTitleTool, {}), replies(automaticReply)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, readTitleInstruction);

  await expect(page.getByRole(`button`, { name: `Show tool call details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByRole(`button`, { name: `Show tool response details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(automaticReply)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByRole(`button`, { name: `Review & approve` })).toHaveCount(0);
  await expect(page.getByText(`Title: New Task`)).toBeVisible();
});

test(`a rejected tool call never runs, and the model is told`, async ({ page, runnableLoop, inference }) => {
  const refusedTitle = `Renamed without asking`;
  const rejectionNote = `Leave the title alone`;

  await inference.mock(scenario().answers(taskInstruction, callsTool(titleTool, { title: refusedTitle }), replies(`Understood, leaving it as it is.`)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, taskInstruction);

  await openToolCallApproval(page, titleToolLabel);
  await rejectToolCall(page, rejectionNote);

  await expect(page.getByText(rejectionNoteInHistory(rejectionNote))).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(`Understood, leaving it as it is.`)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(`Title: New Task`)).toBeVisible();
  await expect(page.getByText(`Title: ${refusedTitle}`)).toHaveCount(0);
});

test(`a tool disabled for the loop is not available to the task`, async ({ page, runnableLoop, inference }) => {
  const loopId = runnableLoop.loop.id;

  // A different tool call proves inference ran after the title tool was disabled.
  await inference.mock(scenario().answers(taskInstruction, callsTool(`athena_define_objective`, { objective: `Establish the cause.` })));

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
