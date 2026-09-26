import { createHash } from "node:crypto";
import type { RagRecordKind, RagRecordSourceWrite, RagTaskQueueItemRenderInput } from "./rag.schema.js";

const maximumSourceBytes = 8 * 1024;
const redactedKeys = new Set([`apikey`, `api_key`, `authorization`, `credential`, `password`, `secret`, `token`]);

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== `object`) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, redactedKeys.has(key.toLowerCase()) ? `[REDACTED]` : redactValue(entry)]),
  );
};

const readableValue = (value: unknown): string => {
  if (typeof value === `string`) return value;
  return JSON.stringify(redactValue(value), null, 2);
};

const truncateUtf8 = (value: string): { text: string; originalByteCount: number; truncated: boolean } => {
  const originalByteCount = Buffer.byteLength(value, `utf8`);
  if (originalByteCount <= maximumSourceBytes) return { text: value, originalByteCount, truncated: false };

  const suffix = `\n\n[Truncated]`;
  const budget = maximumSourceBytes - Buffer.byteLength(suffix, `utf8`);
  let text = value;
  while (Buffer.byteLength(text, `utf8`) > budget) text = text.slice(0, Math.max(0, text.length - 256));
  while (Buffer.byteLength(text, `utf8`) > budget) text = text.slice(0, -1);
  return { text: `${text}${suffix}`, originalByteCount, truncated: true };
};

const inferKind = (input: RagTaskQueueItemRenderInput): RagRecordKind => {
  if (input.kind ?? input.queueItem.activityKind) return (input.kind ?? input.queueItem.activityKind) as RagRecordKind;
  if (input.queueItem.value.role === `tool`) return `toolResult`;
  if (input.queueItem.value.role === `assistant` && input.queueItem.value.tool_calls?.length) return `toolDecision`;
  return `taskMessage`;
};

const renderToolCalls = (toolCalls: NonNullable<RagTaskQueueItemRenderInput[`queueItem`][`value`][`tool_calls`]>): string =>
  toolCalls
    .map((toolCall) => {
      let args: unknown = toolCall.function.arguments;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        // Preserve malformed provider arguments as text; the indexer must not reinterpret them.
      }
      return `Tool requested: ${toolCall.function.name}\nArguments:\n${readableValue(args)}`;
    })
    .join(`\n\n`);

export const renderRagTaskQueueItem = (input: RagTaskQueueItemRenderInput): RagRecordSourceWrite | null => {
  const kind = inferKind(input);
  const content = typeof input.queueItem.value.content === `string` ? input.queueItem.value.content.trim() : readableValue(input.queueItem.value.content);
  const title = input.taskTitle?.trim() || `Untitled task`;
  let body = content;

  if (kind === `toolDecision`) {
    const calls = input.queueItem.value.tool_calls ?? [];
    body = [content, renderToolCalls(calls)].filter(Boolean).join(`\n\n`);
  } else if (kind === `toolResult`) {
    body = `Tool result: ${input.queueItem.value.name ?? `unknown`}\n\n${content}`;
  } else if (kind === `runnerResult`) {
    body = `Runner result\n\n${content}`;
  }

  if (!body) return null;

  const participant = input.queueItem.userName ?? (input.queueItem.value.role === `assistant` ? `Assistant` : input.queueItem.value.role === `user` ? `User` : `Athena`);
  const rendered = `Task: ${title}\nParticipant: ${participant}\n\n${body}`;
  const bounded = truncateUtf8(rendered);

  return {
    loop: input.loop,
    sourceType: `taskQueueItem`,
    sourceId: input.queueItem.id,
    recordKind: kind,
    logicalRef: null,
    text: bounded.text,
    provenance: {
      loop: input.loop,
      task: input.task,
      taskTitle: input.taskTitle,
      queueItem: input.queueItem.id,
      role: input.queueItem.value.role,
      activityKind: kind,
    },
    contentHash: createHash(`sha256`).update(bounded.text).digest(`hex`),
    originalByteCount: bounded.originalByteCount,
    truncated: bounded.truncated,
    occurredAt: input.queueItem.timestamp,
  };
};
