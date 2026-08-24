import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test as baseTest } from "@playwright/test";
import { authenticate } from "./auth.js";
import { type InferenceMock, TestInferenceService, testInferenceBaseUrl } from "./inference.js";
import { prepareRunnableLoop, type RunnableLoop } from "./runnable-loop.js";

export * from "@playwright/test";

type IstanbulCoverage = Record<string, unknown>;
type IstanbulFileCoverage = {
  inputSourceMap?: {
    sources?: string[];
  };
  path?: string;
};

declare global {
  interface Window {
    __coverage__?: IstanbulCoverage;
  }
}

const frontendCoverageDirectory = path.join(process.cwd(), `testing/results/.nyc_frontend`);
let coverageFileSequence = 0;

const remapContainerCoveragePaths = (coverage: IstanbulCoverage): IstanbulCoverage => {
  const remappedCoverage: IstanbulCoverage = {};

  for (const [filePath, fileCoverage] of Object.entries(coverage)) {
    const remappedPath = filePath.replace(/^\/app\//, `${process.cwd()}/`);
    const typedCoverage = fileCoverage as IstanbulFileCoverage;

    remappedCoverage[remappedPath] = {
      ...typedCoverage,
      inputSourceMap: typedCoverage.inputSourceMap
        ? {
            ...typedCoverage.inputSourceMap,
            sources: typedCoverage.inputSourceMap.sources?.map((sourcePath) => sourcePath.replace(/^\/app\//, `${process.cwd()}/`)),
          }
        : undefined,
      path: remappedPath,
    };
  }

  return remappedCoverage;
};

const createCoverageFileName = (titlePath: string[], retry: number, repeatEachIndex: number) => {
  const readableName = titlePath
    .join(` `)
    .replaceAll(/[^a-zA-Z0-9]+/g, `-`)
    .replaceAll(/^-|-$/g, ``)
    .toLowerCase();

  coverageFileSequence += 1;
  return `${readableName || `e2e-coverage`}-${process.pid}-r${retry}-e${repeatEachIndex}-n${coverageFileSequence}.json`;
};

type AthenaFixtures = {
  /** Manages deterministic inference scenarios for one spec. */
  testInference: TestInferenceService;
  /** A runnable loop established entirely through Athena's UI. */
  runnableLoop: RunnableLoop;
  /** Scenario controller bound to the runnable loop's provider credential. */
  inference: InferenceMock;
};

// Keep a local wrapper so future shared fixtures can be added without changing test imports.
export const test = baseTest.extend<AthenaFixtures>({
  testInference: async ({ context: _context }, use) => {
    const testInference = new TestInferenceService(testInferenceBaseUrl);
    await use(testInference);
    await testInference.teardown();
  },

  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (!process.env.COVERAGE) {
      return;
    }

    const coverage = await page.evaluate(() => (globalThis as Window & typeof globalThis).__coverage__).catch(() => undefined);

    if (!coverage || Object.keys(coverage).length === 0) {
      return;
    }

    await mkdir(frontendCoverageDirectory, { recursive: true });
    await writeFile(path.join(frontendCoverageDirectory, createCoverageFileName(testInfo.titlePath, testInfo.retry, testInfo.repeatEachIndex)), JSON.stringify(remapContainerCoveragePaths(coverage)), `utf8`);
  },

  runnableLoop: async ({ page, testInference }, use) => {
    await authenticate(page);
    const runnableLoop = await prepareRunnableLoop(page, testInference);
    await use(runnableLoop);
  },

  inference: async ({ runnableLoop }, use) => {
    await use(runnableLoop.inference);
  },
});
