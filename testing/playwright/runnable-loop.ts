import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { assignProviderToLoopViaUi, assignRunnerToLoopViaUi, assignWorkgraphToLoopViaUi, configureProviderModelsViaUi, createProviderViaUi, createRunnerViaUi, createWorkgraphViaUi } from "./entities.js";
import type { InferenceMock, TestInferenceService } from "./inference.js";
import { createLoop } from "./loop.js";
import { modelValidationScenario } from "./scenario.js";

const runnableLoopModel = `deterministic-chat`;

export type RunnableLoop = {
  loop: { id: string; name: string };
  inference: InferenceMock;
};

export const prepareRunnableLoop = async (page: Page, testInference: TestInferenceService): Promise<RunnableLoop> => {
  const loop = await createLoop(page, `Runnable loop ${randomUUID()}`);
  const providerName = `Provider ${randomUUID()}`;
  const runnerName = `Runner ${randomUUID()}`;
  const workgraphName = `Workgraph ${randomUUID()}`;

  const inference = await testInference.setup(modelValidationScenario(), { name: `provider` });
  await createProviderViaUi(page, providerName, inference.scope);
  await configureProviderModelsViaUi(page, providerName, runnableLoopModel);
  await assignProviderToLoopViaUi(page, loop.id, providerName);

  await createRunnerViaUi(page, runnerName);
  await assignRunnerToLoopViaUi(page, loop.id, runnerName);

  await createWorkgraphViaUi(page, workgraphName);
  await assignWorkgraphToLoopViaUi(page, loop.id, workgraphName);

  await assertLoopIsRunnable(page, loop.id);

  return { loop, inference };
};

const assertLoopIsRunnable = async (page: Page, loopId: string) => {
  await page.goto(`http://athena.localhost/loop/${loopId}/task/list`);

  const pausedBanner = page.getByText(`Loop is paused`);

  if (await pausedBanner.isVisible().catch(() => false)) {
    const detail = await page
      .locator(`.p-notification__content`)
      .first()
      .innerText()
      .catch(() => `unknown blocker`);
    throw new Error(`prepareRunnableLoop left the loop blocked: ${detail.replace(/\s+/gu, ` `).trim()}`);
  }

  await expect(page.getByRole(`button`, { name: `New Task` })).toBeEnabled({ timeout: 20_000 });
};
