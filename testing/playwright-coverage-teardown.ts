import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import coverageLib, { type CoverageMapData } from "istanbul-lib-coverage";

type CoverageMap = CoverageMapData;
type CoverageEntry = {
  inputSourceMap?: {
    sources?: string[];
  };
  path?: string;
};

const backendCoverageDirectory = path.join(process.cwd(), `testing/results/.nyc_backend`);
const frontendCoverageDirectory = path.join(process.cwd(), `testing/results/.nyc_frontend`);
const workerCoverageDirectory = path.join(process.cwd(), `testing/results/.nyc_worker`);
const mergedCoverageDirectory = path.join(process.cwd(), `testing/results/.nyc_merged`);

const remapPath = (filePath: string): string => filePath.replace(/^\/app\//, `${process.cwd()}/`);

const isCoverageMap = (value: unknown): value is CoverageMap => {
  if (!value || typeof value !== `object` || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).some((entry) => {
    if (!entry || typeof entry !== `object` || Array.isArray(entry)) {
      return false;
    }

    return `statementMap` in entry || `path` in entry;
  });
};

const remapCoverageMap = (coverageMap: CoverageMap): CoverageMap => {
  const remappedCoverageMap: CoverageMap = {};

  for (const [filePath, fileCoverage] of Object.entries(coverageMap)) {
    const remappedFilePath = remapPath(filePath);
    const typedCoverage = fileCoverage as CoverageEntry;

    remappedCoverageMap[remappedFilePath] = {
      ...typedCoverage,
      inputSourceMap: typedCoverage.inputSourceMap
        ? {
            ...typedCoverage.inputSourceMap,
            sources: typedCoverage.inputSourceMap.sources?.map(remapPath),
          }
        : undefined,
      path: remappedFilePath,
    } as unknown as CoverageMap[string];
  }

  return remappedCoverageMap;
};

const walkJsonFiles = async (directoryPath: string): Promise<string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return walkJsonFiles(entryPath);
      }

      if (entry.isFile() && entryPath.endsWith(`.json`)) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
};

const readCoverageFile = async (filePath: string): Promise<CoverageMap | null> => {
  const contents = await readFile(filePath, `utf8`);
  const parsed = JSON.parse(contents) as unknown;

  if (!isCoverageMap(parsed)) {
    return null;
  }

  return remapCoverageMap(parsed);
};

const maybeFetchBackendCoverage = async () => {
  try {
    const response = await fetch(`http://athena.localhost/api/__coverage__`);
    if (!response.ok) {
      console.warn(`[coverage] backend coverage endpoint returned HTTP ${response.status}`);
      return;
    }

    const payload = (await response.json()) as unknown;
    if (!isCoverageMap(payload)) {
      console.warn(`[coverage] backend coverage payload was empty or malformed`);
      return;
    }

    await mkdir(backendCoverageDirectory, { recursive: true });
    await writeFile(path.join(backendCoverageDirectory, `backend.json`), JSON.stringify(remapCoverageMap(payload)), `utf8`);
    console.log(`[coverage] backend coverage written`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[coverage] failed to fetch backend coverage: ${message}`);
  }
};

const collectCoverageFiles = async (): Promise<string[]> => {
  const directories = [frontendCoverageDirectory, backendCoverageDirectory, workerCoverageDirectory];

  const files = await Promise.all(
    directories.map(async (directoryPath) => {
      try {
        const directoryStats = await stat(directoryPath);
        if (!directoryStats.isDirectory()) {
          return [];
        }

        return walkJsonFiles(directoryPath);
      } catch {
        return [];
      }
    }),
  );

  return files.flat();
};

export default async () => {
  if (!process.env.COVERAGE) {
    return;
  }

  await maybeFetchBackendCoverage();

  execFileSync(`docker`, [`compose`, `stop`, `--timeout`, `40`, `athena-worker`], {
    cwd: process.cwd(),
    stdio: `inherit`,
  });

  const coverageFiles = await collectCoverageFiles();
  if (coverageFiles.length === 0) {
    throw new Error(`Coverage collection enabled but no frontend/backend coverage files were captured.`);
  }

  const mergedCoverageMap = coverageLib.createCoverageMap({});

  for (const filePath of coverageFiles) {
    const coverageMap = await readCoverageFile(filePath);
    if (!coverageMap) {
      continue;
    }

    mergedCoverageMap.merge(coverageMap);
  }

  await mkdir(mergedCoverageDirectory, { recursive: true });
  await writeFile(path.join(mergedCoverageDirectory, `coverage.json`), JSON.stringify(mergedCoverageMap.toJSON()), `utf8`);
  console.log(`[coverage] merged coverage written`);
};
