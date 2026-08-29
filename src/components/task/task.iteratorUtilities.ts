import { resolveLoopSelection, resolveLoopSelectionByAssignment } from "@components/loop/loop-selection.service.js";
import type { Task } from "@components/task/task.schema.js";
import type { z } from "zod";

type ProviderSelectionResolution = Awaited<ReturnType<typeof resolveLoopSelection>>;
type SelectedProvider = NonNullable<ProviderSelectionResolution["selected"]>;

export type TaskProviderContext = {
  providerResolution: ProviderSelectionResolution;
  baseUrl: string | null;
  model: string | null;
};

type TaskModelNotReady = TaskProviderContext & {
  ready: false;
  reason: "queue-empty" | "provider-unavailable" | "provider-config-invalid";
};

type TaskModelReady = {
  ready: true;
  reason: null;
  providerResolution: Omit<ProviderSelectionResolution, "selected"> & {
    selected: SelectedProvider;
  };
  baseUrl: string;
  model: string;
};

export type TaskModelReadiness = TaskModelReady | TaskModelNotReady;

export const normalizeJsonText = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutOpeningFence = trimmed.replace(/^```(?:json)?\s*/i, "");

  return withoutOpeningFence.replace(/\s*```$/, "").trim();
};

export const parseJsonWithSchema = <T>(schema: z.ZodType<T>, value: string): T | null => {
  try {
    const parsed = JSON.parse(normalizeJsonText(value)) as unknown;
    const result = schema.safeParse(parsed);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const resolveTaskProviderContext = async (task: Pick<Task, "loop" | "currentProvider" | "currentModel">): Promise<TaskProviderContext> => {
  const providerResolution = task.currentProvider ? await resolveLoopSelectionByAssignment(task.loop, `provider`, task.currentProvider, { capability: `chat` }) : await resolveLoopSelection(task.loop, `provider`, { capability: `chat` });

  const baseUrl = providerResolution.selected?.baseUrl ?? null;
  const model = task.currentModel ?? providerResolution.selected?.chatDefaultModel ?? providerResolution.selected?.chatEnabledModels[0] ?? null;

  return {
    providerResolution,
    baseUrl,
    model,
  };
};

export const isTaskReadyForModel = async (
  task: Pick<Task, "loop" | "currentProvider" | "currentModel" | "queue">,
  options?: {
    minQueueLength?: number;
  },
): Promise<TaskModelReadiness> => {
  const minQueueLength = options?.minQueueLength ?? 0;

  if (task.queue.length < minQueueLength) {
    return {
      ready: false,
      reason: "queue-empty",
      providerResolution: { selected: null, audit: { algorithmRequested: "", algorithmUsed: "", fallbackReason: null, skipped: [] } },
      baseUrl: null,
      model: null,
    };
  }

  const providerContext = await resolveTaskProviderContext(task);

  if (!providerContext.providerResolution.selected) {
    return {
      ...providerContext,
      ready: false,
      reason: "provider-unavailable",
    };
  }

  if (!providerContext.baseUrl || !providerContext.model) {
    return {
      ...providerContext,
      ready: false,
      reason: "provider-config-invalid",
    };
  }

  const selected = providerContext.providerResolution.selected;

  if (!selected) {
    return {
      ...providerContext,
      ready: false,
      reason: "provider-unavailable",
    };
  }

  return {
    ready: true,
    reason: null,
    providerResolution: {
      ...providerContext.providerResolution,
      selected,
    },
    baseUrl: providerContext.baseUrl,
    model: providerContext.model,
  };
};
