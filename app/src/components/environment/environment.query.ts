import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { freemem, totalmem } from "node:os";
import { promisify } from "node:util";
import { config } from "@components/config/config.js";
import { type WorkshopEnvironmentSnapshot, workshopEnvironmentSnapshotSchema } from "@components/environment/environment.schemas.js";
import { ollamaClient } from "@components/ollama/ollama.client.js";
import { getAthenaHomeDirectory, getAthenaOllamaBinaryCandidates } from "@components/runtime/runtime.paths.js";

const execFileAsync = promisify(execFile);

const nvidiaSmiBinaryPath = `/usr/bin/nvidia-smi`;

const parseNvidiaSmi = (stdout: string): WorkshopEnvironmentSnapshot[`gpu`][`devices`] => {
  return stdout
    .trim()
    .split(`\n`)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, memoryTotal = null, driverVersion = null] = line.split(`,`).map((part) => part.trim());

      return {
        name,
        memoryTotal,
        driverVersion,
      };
    });
};

const probeBinary = async (path: string) => {
  try {
    await access(path);

    return {
      available: true,
      path,
      error: null,
    };
  } catch (error: unknown) {
    return {
      available: false,
      path,
      error: error instanceof Error ? error.message : `Unknown error`,
    };
  }
};

const probeFirstAvailableBinary = async (paths: string[]) => {
  for (const path of paths) {
    const probe = await probeBinary(path);

    if (probe.available) {
      return probe;
    }
  }

  return {
    available: false,
    path: paths[0] ?? null,
    error: paths.length > 0 ? `Unable to access any configured binary path` : `No binary path configured`,
  };
};

/**
 * Collects a deterministic snapshot of the Athena workshop environment.
 */
export const inspectWorkshopEnvironment = async (): Promise<WorkshopEnvironmentSnapshot> => {
  const [ollamaBinary, nvidiaSmiBinary] = await Promise.all([probeFirstAvailableBinary(getAthenaOllamaBinaryCandidates()), probeBinary(nvidiaSmiBinaryPath)]);

  let models: WorkshopEnvironmentSnapshot[`ollama`][`models`] = [];
  let ollamaListError: string | null = null;

  try {
    models = await ollamaClient.list();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : `Unknown error`;
    ollamaListError = ollamaBinary.available ? message : `${ollamaBinary.error ?? `Ollama binary unavailable`}; ${message}`;
  }

  let devices: WorkshopEnvironmentSnapshot[`gpu`][`devices`] = [];
  let gpuProbeError: string | null = null;

  if (nvidiaSmiBinary.available) {
    try {
      const { stdout } = await execFileAsync(nvidiaSmiBinaryPath, [`--query-gpu=name,memory.total,driver_version`, `--format=csv,noheader`], {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });

      devices = parseNvidiaSmi(stdout);
    } catch (error: unknown) {
      gpuProbeError = error instanceof Error ? error.message : `Unknown error`;
    }
  } else {
    gpuProbeError = nvidiaSmiBinary.error;
  }

  return workshopEnvironmentSnapshotSchema.parse({
    source: `probed`,
    inspectedAt: new Date().toISOString(),
    workshop: {
      user: config.runtime.user,
      homeDirectory: getAthenaHomeDirectory(),
      workingDirectory: process.cwd(),
      hostname: config.runtime.hostname,
    },
    environmentVariables: {
      athenaPort: `${config.app.port}`,
      athenaModelMemoryBudgetRatio: config.environment.athenaModelMemoryBudgetRatio,
      cloudflaredTunnelFqdn: config.environment.cloudflaredTunnelFqdn,
    },
    systemMemory: {
      totalBytes: totalmem(),
      freeBytes: freemem(),
    },
    node: {
      version: process.version,
    },
    binaries: {
      ollama: ollamaBinary,
      nvidiaSmi: nvidiaSmiBinary,
    },
    ollama: {
      models,
      listError: ollamaListError,
    },
    gpu: {
      devices,
      probeError: gpuProbeError,
    },
  });
};
