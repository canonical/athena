import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret } from "@components/utilities/secret-envelope.js";
import type { PoolClient } from "pg";
import type { LoopSelectionPolicy } from "./loop.schema.js";

type SelectionPoolType = `openrouter` | `copilot`;

type SelectionCandidate = {
  assignmentId: string;
  priority: number;
  priorityOverride: number | null;
  enabled: boolean;
  selectionWeight: number;
  remainingCreditPercentage: number | null;
  remainingCreditValue: number | null;
  lastUsedAt: Date | string | null;
  cooldownUntil: Date | string | null;
  healthStatus: `unknown` | `healthy` | `failing`;
  assignmentCreatedAt: Date | string;
  definitionCreatedAt: Date | string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
  definitionType: string;
};

type SelectionAudit = {
  algorithmRequested: string;
  algorithmUsed: string;
  fallbackReason: string | null;
  skipped: Array<{ assignmentId: string; reason: string }>;
};

// Normalize remaining credit percentage (0..100) to a 0..10 scale for weight multiplication.
// Dividing by 10 maps the full 0–100 range to 0–10, which keeps weights proportional while
// preventing credit percentage alone from overwhelming the selectionWeight factor.
const creditWeightDivisor = 10;

export type SelectionResolution = {
  selected: {
    assignmentId: string;
    secret: string;
    algorithm: string;
    definitionType: string;
  } | null;
  audit: SelectionAudit;
};

const deterministicOrder = (left: SelectionCandidate, right: SelectionCandidate): number => {
  const leftPriority = left.priorityOverride ?? left.priority;
  const rightPriority = right.priorityOverride ?? right.priority;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const createdAtDiff = new Date(String(left.assignmentCreatedAt)).getTime() - new Date(String(right.assignmentCreatedAt)).getTime();

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const definitionCreatedAtDiff = new Date(String(left.definitionCreatedAt)).getTime() - new Date(String(right.definitionCreatedAt)).getTime();

  if (definitionCreatedAtDiff !== 0) {
    return definitionCreatedAtDiff;
  }

  return left.assignmentId.localeCompare(right.assignmentId);
};

const isInCooldown = (candidate: SelectionCandidate): boolean => {
  if (!candidate.cooldownUntil) {
    return false;
  }

  return new Date(String(candidate.cooldownUntil)).getTime() > Date.now();
};

const selectRoundRobin = (candidates: SelectionCandidate[], cursor: number): SelectionCandidate => {
  const ordered = [...candidates].sort(deterministicOrder);

  return ordered[cursor % ordered.length] as SelectionCandidate;
};

const selectHighestCreditPercentage = (candidates: SelectionCandidate[]): SelectionCandidate | null => {
  if (candidates.some((candidate) => candidate.remainingCreditPercentage === null)) {
    return null;
  }

  const ordered = [...candidates].sort((left, right) => {
    const difference = (right.remainingCreditPercentage ?? 0) - (left.remainingCreditPercentage ?? 0);

    if (difference !== 0) {
      return difference;
    }

    return deterministicOrder(left, right);
  });

  return ordered[0] ?? null;
};

const selectHighestCreditAbsolute = (candidates: SelectionCandidate[]): SelectionCandidate | null => {
  if (candidates.some((candidate) => candidate.remainingCreditValue === null)) {
    return null;
  }

  const ordered = [...candidates].sort((left, right) => {
    const difference = (right.remainingCreditValue ?? 0) - (left.remainingCreditValue ?? 0);

    if (difference !== 0) {
      return difference;
    }

    return deterministicOrder(left, right);
  });

  return ordered[0] ?? null;
};

const selectWeightedRoundRobin = (candidates: SelectionCandidate[], cursor: number): SelectionCandidate | null => {
  if (candidates.some((candidate) => candidate.remainingCreditPercentage === null)) {
    return null;
  }

  const weighted = [...candidates].sort(deterministicOrder).flatMap((candidate) => {
    const normalizedCredit = (candidate.remainingCreditPercentage ?? 0) / creditWeightDivisor;
    const effectiveCreditWeight = normalizedCredit !== 0 ? normalizedCredit : 1;
    const baseWeight = candidate.selectionWeight || 1;
    const weight = Math.max(1, Math.round(baseWeight * effectiveCreditWeight));
    return Array.from({ length: weight }).map(() => candidate);
  });

  if (weighted.length === 0) {
    return null;
  }

  return weighted[cursor % weighted.length] ?? null;
};

const selectLeastRecentlyUsed = (candidates: SelectionCandidate[]): SelectionCandidate => {
  const ordered = [...candidates].sort((left, right) => {
    if (!left.lastUsedAt && !right.lastUsedAt) {
      return deterministicOrder(left, right);
    }

    if (!left.lastUsedAt) {
      return -1;
    }

    if (!right.lastUsedAt) {
      return 1;
    }

    const difference = new Date(String(left.lastUsedAt)).getTime() - new Date(String(right.lastUsedAt)).getTime();

    if (difference !== 0) {
      return difference;
    }

    return deterministicOrder(left, right);
  });

  return ordered[0] as SelectionCandidate;
};

const selectPriorityFailover = (candidates: SelectionCandidate[]): SelectionCandidate => [...candidates].sort(deterministicOrder)[0] as SelectionCandidate;

const selectHealthAwareCooldown = (candidates: SelectionCandidate[]): SelectionCandidate | null => {
  const healthyCandidates = candidates.filter((candidate) => candidate.healthStatus !== `failing` && !isInCooldown(candidate));

  if (healthyCandidates.length === 0) {
    return null;
  }

  return selectPriorityFailover(healthyCandidates);
};

const getLoopSelectionPolicy = async (client: PoolClient, loopId: string): Promise<LoopSelectionPolicy | undefined> => {
  const result = await client.query<LoopSelectionPolicy>(
    `
      SELECT
        "id" AS "loop",
        "openRouterSelectionAlgorithm",
        "copilotSelectionAlgorithm",
        "openRouterSelectionCursor",
        "copilotSelectionCursor",
        "selectionCooldownWindowMs",
        "updatedAt"
      FROM "loop"
      WHERE "id" = $1
      FOR UPDATE
    `,
    [loopId],
  );

  return result.rows[0];
};

const getCandidates = async (client: PoolClient, loopId: string, pool: SelectionPoolType): Promise<SelectionCandidate[]> => {
  if (pool === `copilot`) {
    const result = await client.query<SelectionCandidate>(
      `
        SELECT
          lhd."harnessDefinition" AS "assignmentId",
          lhd."priority",
          lhd."priorityOverride",
          lhd."enabled",
          lhd."selectionWeight",
          lhd."remainingCreditPercentage",
          lhd."remainingCreditValue",
          lhd."lastUsedAt",
          lhd."cooldownUntil",
          lhd."healthStatus",
          lhd."createdAt" AS "assignmentCreatedAt",
          hd."createdAt" AS "definitionCreatedAt",
          hd."credentialCiphertext",
          hd."credentialIv",
          hd."credentialAuthTag",
          hd."credentialKeyVersion",
          hd."harnessType" AS "definitionType"
        FROM "loopHarnessDefinition" lhd
        JOIN "harnessDefinition" hd ON hd."id" = lhd."harnessDefinition"
        WHERE lhd."loop" = $1
          AND hd."lifecycleStatus" = 'active'
      `,
      [loopId],
    );

    return result.rows;
  }

  const result = await client.query<SelectionCandidate>(
    `
      SELECT
        lpd."providerDefinition" AS "assignmentId",
        lpd."priority",
        lpd."priorityOverride",
        lpd."enabled",
        lpd."selectionWeight",
        lpd."remainingCreditPercentage",
        lpd."remainingCreditValue",
        lpd."lastUsedAt",
        lpd."cooldownUntil",
        lpd."healthStatus",
        lpd."createdAt" AS "assignmentCreatedAt",
        pd."createdAt" AS "definitionCreatedAt",
        pd."credentialCiphertext",
        pd."credentialIv",
        pd."credentialAuthTag",
        pd."credentialKeyVersion",
        pd."providerType" AS "definitionType"
      FROM "loopProviderDefinition" lpd
      JOIN "providerDefinition" pd ON pd."id" = lpd."providerDefinition"
      WHERE lpd."loop" = $1
        AND pd."lifecycleStatus" = 'active'
        AND pd."providerType" = 'openrouter'
    `,
    [loopId],
  );

  return result.rows;
};

const updateCursor = async (client: PoolClient, loopId: string, pool: SelectionPoolType, nextCursor: number): Promise<void> => {
  if (pool === `copilot`) {
    await client.query(`UPDATE "loop" SET "copilotSelectionCursor" = $1 WHERE "id" = $2`, [nextCursor, loopId]);
    return;
  }

  await client.query(`UPDATE "loop" SET "openRouterSelectionCursor" = $1 WHERE "id" = $2`, [nextCursor, loopId]);
};

const touchLastUsed = async (client: PoolClient, loopId: string, pool: SelectionPoolType, assignmentId: string): Promise<void> => {
  if (pool === `copilot`) {
    await client.query(`UPDATE "loopHarnessDefinition" SET "lastUsedAt" = NOW() WHERE "loop" = $1 AND "harnessDefinition" = $2`, [loopId, assignmentId]);
    return;
  }

  await client.query(`UPDATE "loopProviderDefinition" SET "lastUsedAt" = NOW() WHERE "loop" = $1 AND "providerDefinition" = $2`, [loopId, assignmentId]);
};

const evaluateSelection = (algorithm: string, candidates: SelectionCandidate[], cursor: number): { selected: SelectionCandidate | null; algorithmUsed: string; fallbackReason: string | null } => {
  if (candidates.length === 0) {
    return { selected: null, algorithmUsed: algorithm, fallbackReason: null };
  }

  if (algorithm === `round-robin`) {
    return { selected: selectRoundRobin(candidates, cursor), algorithmUsed: algorithm, fallbackReason: null };
  }

  if (algorithm === `highest-credit-percentage`) {
    const selected = selectHighestCreditPercentage(candidates);

    if (selected) {
      return { selected, algorithmUsed: algorithm, fallbackReason: null };
    }

    return { selected: selectPriorityFailover(candidates), algorithmUsed: `priority-failover`, fallbackReason: `Missing remainingCreditPercentage metrics.` };
  }

  if (algorithm === `highest-credit-absolute`) {
    const selected = selectHighestCreditAbsolute(candidates);

    if (selected) {
      return { selected, algorithmUsed: algorithm, fallbackReason: null };
    }

    return { selected: selectPriorityFailover(candidates), algorithmUsed: `priority-failover`, fallbackReason: `Missing remainingCreditValue metrics.` };
  }

  if (algorithm === `weighted-round-robin`) {
    const selected = selectWeightedRoundRobin(candidates, cursor);

    if (selected) {
      return { selected, algorithmUsed: algorithm, fallbackReason: null };
    }

    return { selected: selectPriorityFailover(candidates), algorithmUsed: `priority-failover`, fallbackReason: `Missing credit metrics for weighted round robin.` };
  }

  if (algorithm === `least-recently-used`) {
    return { selected: selectLeastRecentlyUsed(candidates), algorithmUsed: algorithm, fallbackReason: null };
  }

  if (algorithm === `priority-failover`) {
    return { selected: selectPriorityFailover(candidates), algorithmUsed: algorithm, fallbackReason: null };
  }

  const selected = selectHealthAwareCooldown(candidates);

  if (selected) {
    return { selected, algorithmUsed: algorithm, fallbackReason: null };
  }

  return {
    selected: selectPriorityFailover(candidates),
    algorithmUsed: `priority-failover`,
    fallbackReason: `No healthy candidates available after cooldown filtering.`,
  };
};

export const resolveLoopSelection = async (loopId: string, pool: SelectionPoolType): Promise<SelectionResolution> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const policy = await getLoopSelectionPolicy(client, loopId);

    if (!policy) {
      await client.query(`ROLLBACK`);
      return {
        selected: null,
        audit: {
          algorithmRequested: `round-robin`,
          algorithmUsed: `round-robin`,
          fallbackReason: `Loop not found.`,
          skipped: [],
        },
      };
    }

    const algorithmRequested = pool === `copilot` ? policy.copilotSelectionAlgorithm : policy.openRouterSelectionAlgorithm;
    const cursor = pool === `copilot` ? policy.copilotSelectionCursor : policy.openRouterSelectionCursor;
    const candidates = await getCandidates(client, loopId, pool);

    const skipped: Array<{ assignmentId: string; reason: string }> = [];
    const eligible = candidates.filter((candidate) => {
      if (!candidate.enabled) {
        skipped.push({ assignmentId: candidate.assignmentId, reason: `disabled` });
        return false;
      }

      if (pool === `copilot` && candidate.definitionType !== `github-copilot-cloud-agent`) {
        skipped.push({ assignmentId: candidate.assignmentId, reason: `non-mvp-harness` });
        return false;
      }

      if (pool === `openrouter` && candidate.definitionType !== `openrouter`) {
        skipped.push({ assignmentId: candidate.assignmentId, reason: `non-openrouter-provider` });
        return false;
      }

      return true;
    });

    const selection = evaluateSelection(algorithmRequested, eligible, cursor);

    if (!selection.selected) {
      await client.query(`COMMIT`);
      return {
        selected: null,
        audit: {
          algorithmRequested,
          algorithmUsed: selection.algorithmUsed,
          fallbackReason: selection.fallbackReason,
          skipped,
        },
      };
    }

    await touchLastUsed(client, loopId, pool, selection.selected.assignmentId);

    if (selection.algorithmUsed === `round-robin` || selection.algorithmUsed === `weighted-round-robin`) {
      const nextCursor = cursor + 1;
      await updateCursor(client, loopId, pool, nextCursor);
    }

    await client.query(`COMMIT`);

    return {
      selected: {
        assignmentId: selection.selected.assignmentId,
        secret: decryptSecret({
          ciphertext: selection.selected.credentialCiphertext,
          iv: selection.selected.credentialIv,
          authTag: selection.selected.credentialAuthTag,
          keyVersion: selection.selected.credentialKeyVersion,
        }),
        algorithm: selection.algorithmUsed,
        definitionType: selection.selected.definitionType,
      },
      audit: {
        algorithmRequested,
        algorithmUsed: selection.algorithmUsed,
        fallbackReason: selection.fallbackReason,
        skipped,
      },
    };
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};
