import { z } from "zod";
export const commandProbeSchema = z.object({
    available: z.boolean(),
    path: z.string().nullable(),
    error: z.string().nullable(),
});
export const ollamaModelSchema = z.object({
    name: z.string(),
    id: z.string().nullable(),
    size: z.string().nullable(),
    modified: z.string().nullable(),
});
export const gpuDeviceSchema = z.object({
    name: z.string(),
    memoryTotal: z.string().nullable(),
    driverVersion: z.string().nullable(),
});
export const workshopEnvironmentSnapshotSchema = z.object({
    source: z.enum([`cached`, `probed`]),
    inspectedAt: z.string(),
    workshop: z.object({
        user: z.string().nullable(),
        homeDirectory: z.string(),
        workingDirectory: z.string(),
        hostname: z.string(),
    }),
    environmentVariables: z.object({
        athenaPort: z.string().nullable(),
        cloudflaredTunnelFqdn: z.string().nullable(),
    }),
    node: z.object({
        version: z.string(),
    }),
    binaries: z.object({
        ollama: commandProbeSchema,
        nvidiaSmi: commandProbeSchema,
    }),
    ollama: z.object({
        models: z.array(ollamaModelSchema),
        listError: z.string().nullable(),
    }),
    gpu: z.object({
        devices: z.array(gpuDeviceSchema),
        probeError: z.string().nullable(),
    }),
});
//# sourceMappingURL=environment.schemas.js.map