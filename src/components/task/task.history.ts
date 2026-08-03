import type { OpenRouterMessage } from "@components/openrouter/openrouter.schema.js";
import type { Task, TimelineChatTurn } from "./task.schema.js";

type RoutingConversationContext = {
  mode: `full-transcript` | `summary-and-recent`;
  summary: string;
  transcript: string;
  latestUserMessage: string;
};

const fullTranscriptTurnThreshold = 8;
const recentTranscriptTurnCount = 6;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const readString = (value: unknown): string | undefined => (typeof value === `string` && value.trim().length > 0 ? value.trim() : undefined);

const clipText = (value: string | undefined, maxLength: number): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
};

const formatTranscript = (turns: TimelineChatTurn[]): string => (turns.length > 0 ? turns.map((turn) => `${turn.speaker}: ${turn.message}`).join(`\n`) : `No prior conversation transcript.`);

const summarizeOlderConversation = (task: Pick<Task, `description` | `context`>, turns: TimelineChatTurn[], latestUserIndex: number): string => {
  const userTurns = turns.filter((turn) => turn.speaker === `user`);
  const assistantTurns = turns.filter((turn) => turn.speaker === `assistant`);
  const firstUser = userTurns[0]?.message;
  const priorAssistant = latestUserIndex > 0 ? [...turns.slice(0, latestUserIndex)].reverse().find((turn) => turn.speaker === `assistant`)?.message : undefined;

  return [
    `Conversation has ${turns.length} recorded turn(s): ${userTurns.length} user, ${assistantTurns.length} assistant.`,
    task.description ? `Original requested outcome: ${clipText(task.description, 220)}` : null,
    task.context ? `Current task context: ${clipText(task.context, 320)}` : null,
    firstUser ? `First user request: ${clipText(firstUser, 220)}` : null,
    priorAssistant ? `Most recent assistant reply before the latest user message: ${clipText(priorAssistant, 220)}` : null,
  ]
    .filter(Boolean)
    .join(`\n`);
};

export const extractTaskConversationTurns = (task: Pick<Task, `payload`>): TimelineChatTurn[] => {
  const timeline = Array.isArray(task.payload.timeline) ? task.payload.timeline : [];
  const turns: TimelineChatTurn[] = [];

  for (const entry of timeline) {
    if (entry.type !== `chat-session` || !isRecord(entry.data) || !Array.isArray(entry.data.turns)) {
      continue;
    }

    for (const turn of entry.data.turns) {
      if (!isRecord(turn)) {
        continue;
      }

      const speaker = turn.speaker;
      const message = readString(turn.message);

      if ((speaker === `user` || speaker === `assistant` || speaker === `system`) && message) {
        turns.push({ speaker, message });
      }
    }
  }

  return turns;
};

export const buildTaskConversationMessages = (task: Pick<Task, `payload`>): OpenRouterMessage[] =>
  extractTaskConversationTurns(task).map((turn) => ({
    role: turn.speaker,
    content: turn.message,
  }));

export const buildRoutingConversationContext = (task: Pick<Task, `payload` | `description` | `context`>): RoutingConversationContext => {
  const turns = extractTaskConversationTurns(task);
  const latestUserIndex = [...turns].map((turn) => turn.speaker).lastIndexOf(`user`);
  const latestUserMessage = latestUserIndex >= 0 ? turns[latestUserIndex]?.message : undefined;
  const fallbackUserMessage = readString(task.description) ?? readString(task.context) ?? `No latest user message was recorded.`;

  if (turns.length <= fullTranscriptTurnThreshold) {
    return {
      mode: `full-transcript`,
      summary: `Use the full transcript below when making the routing decision.`,
      transcript: formatTranscript(turns),
      latestUserMessage: latestUserMessage ?? fallbackUserMessage,
    };
  }

  const priorTurns = latestUserIndex >= 0 ? turns.slice(0, latestUserIndex) : turns;
  const recentTurns = priorTurns.slice(Math.max(0, priorTurns.length - recentTranscriptTurnCount));

  return {
    mode: `summary-and-recent`,
    summary: summarizeOlderConversation(task, turns, latestUserIndex),
    transcript: formatTranscript(recentTurns),
    latestUserMessage: latestUserMessage ?? fallbackUserMessage,
  };
};

export const buildTaskOpenRouterSessionId = (taskId: string, phase: `routing` | `execution`): string => `task-${taskId}-${phase}`;
