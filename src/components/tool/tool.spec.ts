import type { Page } from "@playwright/test";
import {
  approveToolCall,
  authenticate,
  callsTool,
  createProviderViaUi,
  createTaskViaUi,
  expect,
  openToolCallApproval,
  prepareRunnableLoop,
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

const captureRagScreenshot = async (page: Page, filename: string) => {
  await page.screenshot({ path: `testing/results/rag-screenshots/${filename}` });
};

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

test(`history memory refreshes after approval rejection and compaction`, async ({ page, runnableLoop, inference }) => {
  const memoryTool = `own-memory-lookup`;
  const compactTool = `athena_compact_queue`;
  const approvedTitle = `Approved memory title`;
  const rejectedTitle = `Rejected memory title`;
  const rejectionNote = `Keep the approved title`;
  const compactSummary = `Compaction preserves the approved title and rejected rename decision.`;
  const embedderName = `Mutation memory embedder ${Date.now()}`;

  await createProviderViaUi(page, embedderName, inference.scope, { embedder: { model: `deterministic-embed-16` } });
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/details`);
  await page.getByText(`Create a searchable RAG index from this loop's history`, { exact: true }).click();
  await page.getByLabel(`Embedding provider`).selectOption({ label: `${embedderName} (deterministic-embed-16)` });
  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.getByRole(`button`, { name: `Save history memory` }).click();
  await expect(page.getByText(`The loop's indexed history is ready for lookup.`)).toBeVisible({ timeout: turnTimeout });

  await inference.mock(
    scenario()
      .whenToolOffered(titleTool, callsTool(titleTool, { title: approvedTitle }))
      .onceHistoryShows(approvedTitle, replies(`The approved title is set.`))
      .otherwise(replies(`Nothing to do.`)),
  );
  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, taskInstruction);
  await openToolCallApproval(page, titleToolLabel);
  await approveToolCall(page);
  await expect(page.getByText(`Title: ${approvedTitle}`)).toBeVisible({ timeout: turnTimeout });

  await inference.mock(
    scenario()
      .whenToolOffered(titleTool, callsTool(titleTool, { title: rejectedTitle }))
      .onceHistoryShows(rejectionNoteInHistory(rejectionNote), replies(`The rejected title was not applied.`))
      .otherwise(replies(`Nothing to do.`)),
  );
  await sendTaskMessage(page, `Replace the approved title.`);
  await openToolCallApproval(page, titleToolLabel);
  await rejectToolCall(page, rejectionNote);
  await expect(page.getByText(`The rejected title was not applied.`)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(`Title: ${approvedTitle}`)).toBeVisible();

  await inference.mock(
    scenario()
      .whenToolOffered(compactTool, callsTool(compactTool, { summary: compactSummary }))
      .onceHistoryShows(compactSummary, replies(`Compaction completed.`))
      .otherwise(replies(`Nothing to do.`)),
  );
  await page.getByRole(`button`, { name: `Compact` }).click();
  await page.getByRole(`button`, { name: `Request Compact` }).click();
  await openToolCallApproval(page, `Compact Task Queue`);
  await approveToolCall(page);
  await expect(page.getByText(`Compaction completed.`)).toBeVisible({ timeout: turnTimeout });

  await inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: compactSummary, limit: 20 }))
      .onceHistoryShows(`"provenance"`, replies(`Retrieved compacted history.`))
      .otherwise(replies(`Compacted history was unavailable.`)),
  );
  let refreshedHistoryFound = false;
  for (let attempt = 0; attempt < 5 && !refreshedHistoryFound; attempt += 1) {
    await createTaskViaUi(page, runnableLoop.loop.id);
    await sendTaskMessage(page, `Recall the compacted decision history.`);
    await expect(page.getByText(`Retrieved compacted history.`)).toBeVisible({ timeout: turnTimeout });
    await page.getByRole(`button`, { name: `Show tool response details` }).last().click();
    const resultText = await page.getByRole(`dialog`).innerText();
    refreshedHistoryFound = resultText.includes(compactSummary) && resultText.includes(rejectionNote);
    await page.keyboard.press(`Escape`);
  }
  expect(refreshedHistoryFound).toBe(true);
});

test(`own memory lookup recalls history indexed before it was enabled`, async ({ page, runnableLoop, inference }) => {
  const memoryTool = `own-memory-lookup`;
  const rememberedFact = `The release codename is Silver Kestrel.`;
  const recalledAnswer = `The release codename was Silver Kestrel.`;

  await inference.mock(scenario().whenConversationMentions(rememberedFact, replies(`I will remember that.`)));
  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, rememberedFact);
  await expect(page.getByText(`I will remember that.`)).toBeVisible({ timeout: turnTimeout });
  await captureRagScreenshot(page, `04-source-history.png`);

  const embedderName = `Loop memory embedder ${Date.now()}`;
  await createProviderViaUi(page, embedderName, inference.scope, { embedder: { model: `deterministic-embed-1536` } });
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/details`);
  await page.getByText(`Create a searchable RAG index from this loop's history`, { exact: true }).click();
  await page.getByLabel(`Embedding provider`).selectOption({ label: `${embedderName} (deterministic-embed-1536)` });
  page.once(`dialog`, async (dialog) => {
    expect(dialog.message()).toContain(`rebuild the loop's history index`);
    await dialog.accept();
  });
  await page.getByRole(`button`, { name: `Save history memory` }).click();

  await expect(async () => {
    await page.reload();
    await expect(page.getByText(`The loop's indexed history is ready for lookup.`)).toBeVisible();
  }).toPass({ timeout: turnTimeout });
  await captureRagScreenshot(page, `05-backfill-ready.png`);

  await inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: `release codename`, limit: 5 }))
      .onceHistoryShows(rememberedFact, replies(recalledAnswer))
      .otherwise(replies(`I could not recall it.`)),
  );

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, `What release codename did I give you earlier?`);

  await expect(page.getByRole(`button`, { name: `Show tool call details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByRole(`button`, { name: `Show tool response details` })).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(recalledAnswer)).toBeVisible({ timeout: turnTimeout });

  await page.getByRole(`button`, { name: `Show tool call details` }).click();
  await expect(page.getByRole(`heading`, { name: `Tool call details` })).toBeVisible();
  await captureRagScreenshot(page, `06-memory-lookup-call.png`);
  await page.keyboard.press(`Escape`);

  await page.getByRole(`button`, { name: `Show tool response details` }).click();
  await expect(page.getByRole(`heading`, { name: `Tool response details` })).toBeVisible();
  await expect(page.getByRole(`dialog`)).toContainText(rememberedFact);
  await captureRagScreenshot(page, `07-memory-lookup-result.png`);
  await page.keyboard.press(`Escape`);

  const replacementEmbedderName = `Replacement loop memory embedder ${Date.now()}`;
  await createProviderViaUi(page, replacementEmbedderName, inference.scope, { embedder: { model: `deterministic-embed-16` } });
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/details`);
  await page.getByLabel(`Embedding provider`).selectOption({ label: `${replacementEmbedderName} (deterministic-embed-16)` });
  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.getByRole(`button`, { name: `Save history memory` }).click();
  await expect(page.getByText(`The loop history memory settings were saved.`)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`Embedding provider`).locator(`option:checked`)).toHaveText(`${replacementEmbedderName} (deterministic-embed-16)`);
  await expect(page.getByText(`The loop's indexed history is ready for lookup.`)).toBeVisible({ timeout: turnTimeout });

  const replacementAnswer = `The rebuilt memory still recalls Silver Kestrel.`;
  await inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: rememberedFact, limit: 20 }))
      .onceHistoryShows(`"provenance"`, replies(replacementAnswer))
      .otherwise(replies(`The rebuilt memory did not contain the codename.`)),
  );
  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, `Recall the release codename after rebuilding memory.`);
  await expect(page.getByText(replacementAnswer)).toBeVisible({ timeout: turnTimeout });
  await page.getByRole(`button`, { name: `Show tool response details` }).last().click();
  await expect(page.getByRole(`dialog`)).toContainText(rememberedFact);
  await page.keyboard.press(`Escape`);

  const incrementalFact = `The launch window starts at 07:45 UTC.`;
  await inference.mock(scenario().whenConversationMentions(incrementalFact, replies(`I recorded the launch window.`)).otherwise(replies(`Nothing else to add.`)));
  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, incrementalFact);
  await expect(page.getByText(`I recorded the launch window.`)).toBeVisible({ timeout: turnTimeout });

  const incrementalAnswer = `The launch window starts at 07:45 UTC.`;
  await inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: incrementalFact, limit: 20 }))
      .onceHistoryShows(`"provenance"`, replies(incrementalAnswer))
      .otherwise(replies(`The launch window was not indexed.`)),
  );
  let incrementalFactIndexed = false;
  for (let attempt = 0; attempt < 5 && !incrementalFactIndexed; attempt += 1) {
    await createTaskViaUi(page, runnableLoop.loop.id);
    await sendTaskMessage(page, `When does the launch window start?`);
    await expect(page.getByText(incrementalAnswer)).toBeVisible({ timeout: turnTimeout });
    await page.getByRole(`button`, { name: `Show tool response details` }).last().click();
    incrementalFactIndexed = (await page.getByRole(`dialog`).innerText()).includes(incrementalFact);
    await page.keyboard.press(`Escape`);
  }
  expect(incrementalFactIndexed).toBe(true);
});

test(`two loops backfill and retrieve only their own history`, async ({ page, context, testInference }) => {
  await authenticate(page);
  const firstLoop = await prepareRunnableLoop(page, testInference);
  const secondPage = await context.newPage();
  const secondLoop = await prepareRunnableLoop(secondPage, testInference);
  const firstFact = `Loop one deployment marker is Alpine Quartz.`;
  const secondFact = `Loop two deployment marker is Harbor Lantern.`;

  await firstLoop.inference.mock(scenario().whenConversationMentions(firstFact, replies(`Recorded the first marker.`)).otherwise(replies(`Nothing else to add.`)));
  await secondLoop.inference.mock(scenario().whenConversationMentions(secondFact, replies(`Recorded the second marker.`)).otherwise(replies(`Nothing else to add.`)));
  await createTaskViaUi(page, firstLoop.loop.id);
  await sendTaskMessage(page, firstFact);
  await expect(page.getByText(`Recorded the first marker.`)).toBeVisible({ timeout: turnTimeout });
  await createTaskViaUi(secondPage, secondLoop.loop.id);
  await sendTaskMessage(secondPage, secondFact);
  await expect(secondPage.getByText(`Recorded the second marker.`)).toBeVisible({ timeout: turnTimeout });

  const embedderName = `Shared isolation embedder ${Date.now()}`;
  await createProviderViaUi(page, embedderName, firstLoop.inference.scope, { embedder: { model: `deterministic-embed-16` } });

  const prepareMemoryForm = async (targetPage: Page, loopId: string) => {
    await targetPage.goto(`http://athena.localhost/loop/${loopId}/details`);
    await targetPage.getByText(`Create a searchable RAG index from this loop's history`, { exact: true }).click();
    await targetPage.getByLabel(`Embedding provider`).selectOption({ label: `${embedderName} (deterministic-embed-16)` });
    targetPage.once(`dialog`, (dialog) => void dialog.accept());
  };

  await Promise.all([prepareMemoryForm(page, firstLoop.loop.id), prepareMemoryForm(secondPage, secondLoop.loop.id)]);
  await Promise.all([page.getByRole(`button`, { name: `Save history memory` }).click(), secondPage.getByRole(`button`, { name: `Save history memory` }).click()]);
  await Promise.all([
    expect(page.getByText(`The loop's indexed history is ready for lookup.`)).toBeVisible({ timeout: turnTimeout }),
    expect(secondPage.getByText(`The loop's indexed history is ready for lookup.`)).toBeVisible({ timeout: turnTimeout }),
  ]);

  const memoryTool = `own-memory-lookup`;
  await firstLoop.inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: firstFact, limit: 20 }))
      .onceHistoryShows(`"provenance"`, replies(`Retrieved the first marker.`))
      .otherwise(replies(`The first marker was unavailable.`)),
  );
  await secondLoop.inference.mock(
    scenario()
      .whenToolOffered(memoryTool, callsTool(memoryTool, { query: secondFact, limit: 20 }))
      .onceHistoryShows(`"provenance"`, replies(`Retrieved the second marker.`))
      .otherwise(replies(`The second marker was unavailable.`)),
  );

  await Promise.all([createTaskViaUi(page, firstLoop.loop.id), createTaskViaUi(secondPage, secondLoop.loop.id)]);
  await Promise.all([sendTaskMessage(page, `Recall this loop's deployment marker.`), sendTaskMessage(secondPage, `Recall this loop's deployment marker.`)]);
  await Promise.all([expect(page.getByText(`Retrieved the first marker.`)).toBeVisible({ timeout: turnTimeout }), expect(secondPage.getByText(`Retrieved the second marker.`)).toBeVisible({ timeout: turnTimeout })]);

  await page.getByRole(`button`, { name: `Show tool response details` }).last().click();
  await expect(page.getByRole(`dialog`)).toContainText(firstFact);
  await expect(page.getByRole(`dialog`)).not.toContainText(secondFact);
  await page.keyboard.press(`Escape`);
  await secondPage.getByRole(`button`, { name: `Show tool response details` }).last().click();
  await expect(secondPage.getByRole(`dialog`)).toContainText(secondFact);
  await expect(secondPage.getByRole(`dialog`)).not.toContainText(firstFact);
  await secondPage.close();
});
