import {
  assignProviderToLoopViaUi,
  authenticate,
  callsTool,
  configureProviderModelsViaUi,
  createLoop,
  createProviderViaUi,
  createTaskViaUi,
  dexEmail,
  dexLoopMemberEmail,
  expect,
  replies,
  scenario,
  sendTaskMessage,
  test,
  testInferenceChatModel,
  testInferenceEmbeddingModel,
  turnTimeout,
} from "../../../testing/playwright/index.js";

test(`a persona retrieves attributable evidence from loop memory`, async ({ page, runnableLoop }) => {
  const fact = `The Borealis launch authorization phrase is violet-cascade-47.`;
  const factAcknowledgement = `I have recorded the Borealis launch authorization phrase.`;
  const question = `What is the Borealis launch authorization phrase? Search loop memory before answering.`;
  const answer = `The Borealis launch authorization phrase is violet-cascade-47.`;

  await runnableLoop.inference.mock(
    scenario()
      .answers(fact, replies(factAcknowledgement))
      .answers(question, callsTool(`rag_lookup`, { index: `self`, query: `Borealis launch authorization phrase violet-cascade-47`, limit: 3 }), replies(answer)),
  );

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, fact);
  await expect(page.getByText(factAcknowledgement)).toBeVisible({ timeout: turnTimeout });

  const embeddingProviderName = `Retrieval memory provider ${Date.now()}`;
  await createProviderViaUi(page, embeddingProviderName);
  await configureProviderModelsViaUi(page, embeddingProviderName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, runnableLoop.loop.id, embeddingProviderName);
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/memory`);
  await page.getByLabel(`Embedding provider`).selectOption({ label: embeddingProviderName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();

  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, question);

  await expect(page.getByText(`Search Loop Index`)).toBeVisible({ timeout: turnTimeout });
  await expect(page.getByText(answer)).toBeVisible({ timeout: turnTimeout });
  await page.getByRole(`button`, { name: `Show tool response details` }).click();
  await expect(page.getByRole(`heading`, { name: `Tool response details` })).toBeVisible();
  await expect(page.locator(`.string-value`).filter({ hasText: `violet-cascade-47` }).first()).toBeVisible();
  await expect(page.locator(`.string-value`).filter({ hasText: `taskMessage` }).first()).toBeVisible();
});

test(`memory appends new loop messages in the background`, async ({ page, runnableLoop }) => {
  const message = `The deployment uses a short cache retention period.`;
  const reply = `Noted the deployment-specific retention detail.`;
  await runnableLoop.inference.mock(scenario().answers(message, replies(reply)));

  const embeddingProviderName = `Live memory projection provider ${Date.now()}`;
  await createProviderViaUi(page, embeddingProviderName);
  await configureProviderModelsViaUi(page, embeddingProviderName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, runnableLoop.loop.id, embeddingProviderName);
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/memory`);
  await page.getByLabel(`Embedding provider`).selectOption({ label: embeddingProviderName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();

  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, message);
  await expect(page.getByText(reply)).toBeVisible({ timeout: 60_000 });

  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/details`);
  await expect
    .poll(async () => {
      await page.reload();
      return Number(await page.locator(`#loop-details-rag-projected-count`).textContent());
    })
    .toBeGreaterThan(0);
});

test(`memory builds existing loop messages in the background`, async ({ page, runnableLoop }) => {
  const message = `We chose versioned cache keys because direct invalidation caused races.`;
  const reply = `Understood. I will remember the versioned cache key decision.`;
  await runnableLoop.inference.mock(scenario().answers(message, replies(reply)));

  await createTaskViaUi(page, runnableLoop.loop.id);
  await sendTaskMessage(page, message);
  await expect(page.getByText(reply)).toBeVisible({ timeout: 60_000 });

  const embeddingProviderName = `Historical memory projection provider ${Date.now()}`;
  await createProviderViaUi(page, embeddingProviderName);
  await configureProviderModelsViaUi(page, embeddingProviderName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, runnableLoop.loop.id, embeddingProviderName);
  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/memory`);
  await page.getByLabel(`Embedding provider`).selectOption({ label: embeddingProviderName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();

  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);

  const initialIndexId = await page.locator(`#rag-index-id`).textContent();
  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.getByRole(`button`, { name: `Remove memory` }).click();
  await expect(page.locator(`#rag-index-status`)).toHaveText(`Not configured`);

  await page.getByLabel(`Embedding provider`).selectOption({ label: embeddingProviderName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();
  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);
  await expect(page.locator(`#rag-index-id`)).not.toHaveText(initialIndexId ?? ``);

  await page.getByRole(`button`, { name: `Scan and repair memory` }).click();
  await expect(page.getByText(`Memory scan and repair has been queued.`)).toBeVisible();
  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);

  await page.goto(`http://athena.localhost/loop/${runnableLoop.loop.id}/details`);
  await expect
    .poll(async () => {
      await page.reload();
      return Number(await page.locator(`#loop-details-rag-projected-count`).textContent());
    })
    .toBeGreaterThan(0);
});

test(`loop admin configures an index provider independently from the loop chat provider`, async ({ page, testInference }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Memory loop ${Date.now()}`);
  const chatProviderName = `Memory chat provider ${Date.now()}`;
  const embeddingProviderName = `Memory embedding provider ${Date.now()}`;
  const chatInference = await testInference.setup(scenario().answersModelValidation(), { name: `memory-chat-provider` });

  await createProviderViaUi(page, chatProviderName, chatInference.scope);
  await configureProviderModelsViaUi(page, chatProviderName, `chat`, testInferenceChatModel);
  await assignProviderToLoopViaUi(page, loop.id, chatProviderName);
  await createProviderViaUi(page, embeddingProviderName);
  await configureProviderModelsViaUi(page, embeddingProviderName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, loop.id, embeddingProviderName);

  await page.goto(`http://athena.localhost/loop/${loop.id.toUpperCase()}/memory`);
  await expect(page.getByRole(`heading`, { name: `Memory` })).toBeVisible();
  await expect(page.locator(`#rag-index-status`)).toHaveText(`Not configured`);

  const providerSelect = page.getByLabel(`Embedding provider`);
  await expect(providerSelect.getByRole(`option`, { name: chatProviderName })).toHaveCount(0);
  await providerSelect.selectOption({ label: embeddingProviderName });
  await expect(page.getByLabel(`Embedding model`)).toHaveValue(testInferenceEmbeddingModel);
  await page.getByRole(`button`, { name: `Enable memory` }).click();

  await expect(page.getByText(`Memory has been enabled.`)).toBeVisible();
  await expect
    .poll(async () => {
      await page.reload();
      return page.locator(`#rag-index-status`).textContent();
    })
    .toBe(`ready`);

  await expect(page.locator(`#rag-index-source-strategy`)).toHaveText(`Loop activity`);
  await expect(page.locator(`#rag-index-source-ref`)).toHaveText(loop.id);
  await expect(page.locator(`#rag-index-segmentation`)).toHaveText(`Whole entry`);
  await expect(page.locator(`#rag-index-provider-name`)).toHaveText(embeddingProviderName);
  await expect(page.locator(`#rag-index-embedding-model`)).toHaveText(testInferenceEmbeddingModel);
  await expect(page.locator(`#rag-index-source-count`)).toHaveText(`0`);

  const initialIndexId = await page.locator(`#rag-index-id`).textContent();
  const replacementProviderName = `Replacement embedding provider ${Date.now()}`;
  await createProviderViaUi(page, replacementProviderName);
  await configureProviderModelsViaUi(page, replacementProviderName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, loop.id, replacementProviderName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/memory`);
  page.once(`dialog`, (dialog) => void dialog.accept());
  await page.getByRole(`button`, { name: `Remove memory` }).click();
  await page.getByLabel(`Embedding provider`).selectOption({ label: replacementProviderName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();

  await expect(page.locator(`#rag-index-id`)).not.toHaveText(initialIndexId ?? ``);
  await expect(page.locator(`#rag-index-provider-name`)).toHaveText(replacementProviderName);

  const replacementIndexId = await page.locator(`#rag-index-id`).textContent();
  expect(replacementIndexId).not.toBeNull();

  await page.goto(`http://athena.localhost/provider/list`);
  await page
    .getByRole(`button`, { name: `Edit ${embeddingProviderName}` })
    .first()
    .click();
  await page.locator(`form`).first().getByRole(`button`, { name: `Delete provider` }).click();
  await expect(page.getByText(`${embeddingProviderName} has been deleted.`)).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/providers`);
  await page.getByRole(`button`, { name: `Remove ${replacementProviderName}` }).click();
  await expect(page.getByText(`Provider cannot be removed from loop ${loop.id} because it is used by RAG index ${replacementIndexId}.`)).toBeVisible();

  await page.goto(`http://athena.localhost/provider/list`);
  await page
    .getByRole(`button`, { name: `Edit ${replacementProviderName}` })
    .first()
    .click();
  await page.locator(`form`).first().getByRole(`button`, { name: `Delete provider` }).click();
  await expect(page.getByText(`Provider cannot be deleted because it is used by loops: ${loop.id}.`)).toBeVisible();

  await page.goto(`http://athena.localhost/`);
  page.once(`dialog`, (dialog) => void dialog.accept());
  const loopRow = page
    .getByRole(`row`)
    .filter({ has: page.getByRole(`link`, { name: loop.name, exact: true }) })
    .first();
  await loopRow.getByRole(`button`, { name: `Delete` }).click();
  await expect(page.getByText(`${loop.name} has been deleted.`)).toBeVisible();

  await page.goto(`http://athena.localhost/provider/list`);
  await page
    .getByRole(`button`, { name: `Edit ${replacementProviderName}` })
    .first()
    .click();
  await page.locator(`form`).first().getByRole(`button`, { name: `Delete provider` }).click();
  await expect(page.getByText(`${replacementProviderName} has been deleted.`)).toBeVisible();
});

test(`memory configuration requires an eligible embedding provider`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Memory without embeddings ${Date.now()}`);
  await page.goto(`http://athena.localhost/loop/${loop.id}/memory`);

  await expect(page.getByText(`No assigned embedding-capable provider is available.`)).toBeVisible();
  await expect(page.getByLabel(`Embedding provider`)).toHaveValue(``);
  await expect(page.getByLabel(`Embedding model`)).toBeDisabled();
  await expect(page.getByRole(`button`, { name: `Enable memory` })).toBeDisabled();
});

test(`loop member can view memory status but cannot change configuration`, async ({ page }) => {
  await authenticate(page, { email: dexEmail, password: `password` });

  const loop = await createLoop(page, `Read-only memory loop ${Date.now()}`);
  const providerName = `Read-only memory provider ${Date.now()}`;
  await createProviderViaUi(page, providerName);
  await configureProviderModelsViaUi(page, providerName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, loop.id, providerName);
  await page.goto(`http://athena.localhost/loop/${loop.id}/memory`);
  await page.getByLabel(`Embedding provider`).selectOption({ label: providerName });
  await page.getByRole(`button`, { name: `Enable memory` }).click();
  await expect(page.getByText(`Memory has been enabled.`)).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await page.getByRole(`button`, { name: `Invite member` }).click();
  await page.getByLabel(`Email`).fill(dexLoopMemberEmail);
  await page.getByRole(`button`, { name: `Send invite` }).click();
  await expect(page.getByText(`Pending invite for ${dexLoopMemberEmail} created successfully.`)).toBeVisible();

  await authenticate(page, { email: dexLoopMemberEmail, password: `password` });
  await page.goto(`http://athena.localhost/`);
  await page
    .getByRole(`row`, { name: new RegExp(loop.name) })
    .getByRole(`button`, { name: `Accept invite` })
    .click();
  await expect(page.getByText(`You have joined ${loop.name}.`)).toBeVisible();

  await page.goto(`http://athena.localhost/loop/${loop.id}/memory`);
  await expect(page.locator(`#rag-index-status`)).not.toHaveText(`Not configured`);
  await expect(page.getByText(`Only loop admins may change memory configuration.`)).toBeVisible();
  await expect(page.getByRole(`button`, { name: `Scan and repair memory` })).toHaveCount(0);
  await expect(page.getByRole(`button`, { name: `Remove memory` })).toHaveCount(0);
});

test(`demoted loop admin cannot submit memory configuration from a stale page`, async ({ page, browser }) => {
  await authenticate(page, { email: dexEmail, password: `password` });

  const loop = await createLoop(page, `Demoted memory admin ${Date.now()}`);
  const providerName = `Demoted memory provider ${Date.now()}`;
  await createProviderViaUi(page, providerName);
  await configureProviderModelsViaUi(page, providerName, `embedding`, testInferenceEmbeddingModel);
  await assignProviderToLoopViaUi(page, loop.id, providerName);

  await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
  await page.getByRole(`button`, { name: `Invite member` }).click();
  await page.getByLabel(`Email`).fill(dexLoopMemberEmail);
  await page.getByRole(`button`, { name: `Send invite` }).click();
  await expect(page.getByText(`Pending invite for ${dexLoopMemberEmail} created successfully.`)).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  try {
    await authenticate(memberPage, { email: dexLoopMemberEmail, password: `password` });
    await memberPage.goto(`http://athena.localhost/`);
    await memberPage
      .getByRole(`row`, { name: new RegExp(loop.name) })
      .getByRole(`button`, { name: `Accept invite` })
      .click();
    await expect(memberPage.getByText(`You have joined ${loop.name}.`)).toBeVisible();

    await page.goto(`http://athena.localhost/loop/${loop.id}/members`);
    await page
      .getByRole(`row`)
      .filter({ has: page.getByText(dexLoopMemberEmail, { exact: true }) })
      .getByRole(`button`, { name: `Promote` })
      .click();
    await expect(page.getByText(`${dexLoopMemberEmail} is now an admin.`)).toBeVisible();

    await page.goto(`http://athena.localhost/loop/${loop.id}/memory`);
    await expect(page.getByRole(`button`, { name: `Enable memory` })).toBeEnabled();

    await memberPage.goto(`http://athena.localhost/loop/${loop.id}/members`);
    await memberPage
      .getByRole(`row`)
      .filter({ has: memberPage.getByText(dexEmail, { exact: true }) })
      .getByRole(`button`, { name: `Demote` })
      .click();
    await expect(memberPage.getByText(`${dexEmail} is now a member.`)).toBeVisible();

    await page.getByRole(`button`, { name: `Enable memory` }).click();
    await expect(page.getByText(`Only loop admins may configure memory.`)).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
