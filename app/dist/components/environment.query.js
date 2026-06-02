import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { workshopEnvironmentSnapshotSchema } from "./environment.schemas.js";
import { ollamaClient } from "./ollama.client.js";
const execFileAsync = promisify(execFile);
const ollamaBinaryPath = `/var/lib/workshop/sdk/ollama/bin/ollama`;
const nvidiaSmiBinaryPath = `/usr/bin/nvidia-smi`;
const parseNvidiaSmi = (stdout) => {
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
const probeBinary = async (path) => {
    try {
        await access(path);
        return {
            available: true,
            path,
            error: null,
        };
    }
    catch (error) {
        return {
            available: false,
            path,
            error: error instanceof Error ? error.message : `Unknown error`,
        };
    }
};
/**
 * Collects a deterministic snapshot of the Athena workshop environment.
 */
export const inspectWorkshopEnvironment = async () => {
    const [ollamaBinary, nvidiaSmiBinary] = await Promise.all([probeBinary(ollamaBinaryPath), probeBinary(nvidiaSmiBinaryPath)]);
    let models = [];
    let ollamaListError = null;
    if (ollamaBinary.available) {
        try {
            models = await ollamaClient.list();
        }
        catch (error) {
            ollamaListError = error instanceof Error ? error.message : `Unknown error`;
        }
    }
    else {
        ollamaListError = ollamaBinary.error;
    }
    let devices = [];
    let gpuProbeError = null;
    if (nvidiaSmiBinary.available) {
        try {
            const { stdout } = await execFileAsync(nvidiaSmiBinaryPath, [`--query-gpu=name,memory.total,driver_version`, `--format=csv,noheader`], {
                timeout: 10_000,
                maxBuffer: 1024 * 1024,
            });
            devices = parseNvidiaSmi(stdout);
        }
        catch (error) {
            gpuProbeError = error instanceof Error ? error.message : `Unknown error`;
        }
    }
    else {
        gpuProbeError = nvidiaSmiBinary.error;
    }
    return workshopEnvironmentSnapshotSchema.parse({
        source: `probed`,
        inspectedAt: new Date().toISOString(),
        workshop: {
            user: process.env.USER ?? null,
            homeDirectory: process.env.HOME ?? `/home/workshop`,
            workingDirectory: process.cwd(),
            hostname: process.env.HOSTNAME ?? `unknown`,
        },
        environmentVariables: {
            athenaPort: process.env.ATHENA_PORT ?? null,
            cloudflaredTunnelFqdn: process.env.CLOUDFLARED_TUNNEL_FQDN ?? null,
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
//# sourceMappingURL=environment.query.js.map