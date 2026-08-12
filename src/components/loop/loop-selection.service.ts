import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret } from "@components/utilities/secret-envelope.js";
import type { PoolClient } from "pg";
import type { ProviderSelectionPolicy } from "./loop.schema.js";

type SelectionPoolType = `provider` | `runner`;

type SelectionCandidate = {
  assignmentId: string;
  priority: number;
  priorityOverride: number | null;
  enabled: boolean;
  selectionWeight: number;
  remainingCreditPercentage: number | null;
  remainingCreditValue: number | null;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  healthStatus: `unknown` | `healthy` | `failing`;
  assignmentCreatedAt: string;
  definitionCreatedAt: string;
  assignmentOverrides: Record<string, unknown>;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
  definitionType: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabledModels: string[];
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
    baseUrl: string | null;
    defaultModel: string | null;
    enabledModels: string[];
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
    const baseWeight = candidate.selectionWeight || 1;
    const weight = Math.max(0, Math.round(baseWeight * normalizedCredit));

    if (weight === 0) {
      return [];
    }

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

const getLoopProviderSelectionPolicy = async (client: PoolClient, loopId: string): Promise<ProviderSelectionPolicy | undefined> => {
  const result = await client.query<ProviderSelectionPolicy>(
    `
      SELECT
        "id" AS "loop",
        "providerSelectionAlgorithm",
        "providerSelectionCursor",
        "runnerSelectionAlgorithm",
        "runnerSelectionCursor",
        "updatedAt"
      FROM "loop"
      WHERE "id" = $1
      FOR UPDATE
    `,
    [loopId],
  );

  return result.rows[0];
};

const getCandidates = async (client: PoolClient, loopId: string, pool: SelectionPoolType, repositoryId?: string): Promise<SelectionCandidate[]> => {
  if (pool === `runner`) {
    const result = await client.query<SelectionCandidate>(
      `
        SELECT
          lh."runner" AS "assignmentId",
          lh."priority",
          lh."priorityOverride",
          lh."enabled",
          lh."selectionWeight",
          lh."remainingCreditPercentage",
          lh."remainingCreditValue",
          lh."lastUsedAt",
          lh."cooldownUntil",
          lh."healthStatus",
          lh."createdAt" AS "assignmentCreatedAt",
          h."createdAt" AS "definitionCreatedAt",
          lh."assignmentOverrides",
          h."credentialCiphertext",
          h."credentialIv",
          h."credentialAuthTag",
          h."credentialKeyVersion",
          h."runnerType" AS "definitionType",
          NULL::text AS "baseUrl",
          NULL::text AS "defaultModel",
          ARRAY[]::text[] AS "enabledModels"
        FROM "loopRunner" lh
        JOIN "runner" h ON h."id" = lh."runner"
        WHERE lh."loop" = $1
          AND h."lifecycleStatus" = 'active'
          AND (
            $2::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM "loopRunnerRepository" lrr
              WHERE lrr."loop" = lh."loop"
                AND lrr."runner" = lh."runner"
                AND lrr."repository" = $2::uuid
                AND lrr."enabled" = TRUE
            )
          )
      `,
      [loopId, repositoryId ?? null],
    );

    return result.rows;
  }

  const result = await client.query<SelectionCandidate>(
    `
      SELECT
        lp."provider" AS "assignmentId",
        lp."priority",
        lp."priorityOverride",
        lp."enabled",
        lp."selectionWeight",
        lp."remainingCreditPercentage",
        lp."remainingCreditValue",
        lp."lastUsedAt",
        lp."cooldownUntil",
        lp."healthStatus",
        lp."createdAt" AS "assignmentCreatedAt",
        p."createdAt" AS "definitionCreatedAt",
        lp."assignmentOverrides",
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion",
        p."providerType" AS "definitionType",
        p."baseUrl",
        p."defaultModel",
        p."enabledModels"
      FROM "loopProvider" lp
      JOIN "provider" p ON p."id" = lp."provider"
      WHERE lp."loop" = $1
        AND p."lifecycleStatus" = 'active'
        AND p."providerType" = 'openrouter'
    `,
    [loopId],
  );

  return result.rows;
};

const updateCursor = async (client: PoolClient, loopId: string, pool: SelectionPoolType, nextCursor: number): Promise<void> => {
  if (pool === `runner`) {
    await client.query(`UPDATE "loop" SET "runnerSelectionCursor" = $1 WHERE "id" = $2`, [nextCursor, loopId]);
    return;
  }

  await client.query(`UPDATE "loop" SET "providerSelectionCursor" = $1 WHERE "id" = $2`, [nextCursor, loopId]);
};

const touchLastUsed = async (client: PoolClient, loopId: string, pool: SelectionPoolType, assignmentId: string): Promise<void> => {
  if (pool === `runner`) {
    await client.query(`UPDATE "loopRunner" SET "lastUsedAt" = NOW() WHERE "loop" = $1 AND "runner" = $2`, [loopId, assignmentId]);
    return;
  }

  await client.query(`UPDATE "loopProvider" SET "lastUsedAt" = NOW() WHERE "loop" = $1 AND "provider" = $2`, [loopId, assignmentId]);
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
    if (candidates.some((candidate) => candidate.remainingCreditPercentage === null)) {
      return { selected: selectPriorityFailover(candidates), algorithmUsed: `priority-failover`, fallbackReason: `Missing credit metrics for weighted round robin.` };
    }

    const selected = selectWeightedRoundRobin(candidates, cursor);

    if (selected) {
      return { selected, algorithmUsed: algorithm, fallbackReason: null };
    }

    return { selected: null, algorithmUsed: algorithm, fallbackReason: `No candidates with remaining credit for weighted round robin.` };
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

export const resolveLoopSelection = async (loopId: string, pool: SelectionPoolType, options?: { repositoryId?: string }): Promise<SelectionResolution> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const policy = await getLoopProviderSelectionPolicy(client, loopId);

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

    const algorithmRequested = pool === `runner` ? policy.runnerSelectionAlgorithm : policy.providerSelectionAlgorithm;
    const cursor = pool === `runner` ? policy.runnerSelectionCursor : policy.providerSelectionCursor;
    const candidates = await getCandidates(client, loopId, pool, pool === `runner` ? options?.repositoryId : undefined);

    const skipped: Array<{ assignmentId: string; reason: string }> = [];
    const eligible = candidates.filter((candidate) => {
      if (!candidate.enabled) {
        skipped.push({ assignmentId: candidate.assignmentId, reason: `disabled` });
        return false;
      }

      if (pool === `runner` && candidate.definitionType !== `github-copilot-cloud`) {
        skipped.push({ assignmentId: candidate.assignmentId, reason: `non-mvp-runner` });
        return false;
      }

      if (pool === `provider` && candidate.definitionType !== `openrouter`) {
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
        baseUrl: selection.selected.baseUrl,
        defaultModel: selection.selected.defaultModel,
        enabledModels: selection.selected.enabledModels,
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

export const resolveLoopSelectionByAssignment = async (loopId: string, pool: SelectionPoolType, assignmentId: string, options?: { repositoryId?: string }): Promise<SelectionResolution> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const policy = await getLoopProviderSelectionPolicy(client, loopId);

    if (!policy) {
      await client.query(`ROLLBACK`);
      return {
        selected: null,
        audit: {
          algorithmRequested: `priority-failover`,
          algorithmUsed: `priority-failover`,
          fallbackReason: `Loop not found.`,
          skipped: [],
        },
      };
    }

    const algorithmRequested = pool === `runner` ? policy.runnerSelectionAlgorithm : policy.providerSelectionAlgorithm;
    const candidates = await getCandidates(client, loopId, pool, pool === `runner` ? options?.repositoryId : undefined);

    const skipped: Array<{ assignmentId: string; reason: string }> = [];
    const selected = candidates.find((candidate) => candidate.assignmentId === assignmentId);

    if (!selected) {
      await client.query(`COMMIT`);
      return {
        selected: null,
        audit: {
          algorithmRequested,
          algorithmUsed: `sticky-assignment`,
          fallbackReason: `Assigned target is not currently available in loop assignments.`,
          skipped,
        },
      };
    }

    if (!selected.enabled) {
      skipped.push({ assignmentId: selected.assignmentId, reason: `disabled` });
    }

    if (pool === `runner` && selected.definitionType !== `github-copilot-cloud`) {
      skipped.push({ assignmentId: selected.assignmentId, reason: `non-mvp-runner` });
    }

    if (pool === `provider` && selected.definitionType !== `openrouter`) {
      skipped.push({ assignmentId: selected.assignmentId, reason: `non-openrouter-provider` });
    }

    if (skipped.length > 0) {
      await client.query(`COMMIT`);
      return {
        selected: null,
        audit: {
          algorithmRequested,
          algorithmUsed: `sticky-assignment`,
          fallbackReason: `Assigned target is not eligible for execution.`,
          skipped,
        },
      };
    }

    await touchLastUsed(client, loopId, pool, selected.assignmentId);
    await client.query(`COMMIT`);

    return {
      selected: {
        assignmentId: selected.assignmentId,
        secret: decryptSecret({
          ciphertext: selected.credentialCiphertext,
          iv: selected.credentialIv,
          authTag: selected.credentialAuthTag,
          keyVersion: selected.credentialKeyVersion,
        }),
        algorithm: `sticky-assignment`,
        definitionType: selected.definitionType,
        baseUrl: selected.baseUrl,
        defaultModel: selected.defaultModel,
        enabledModels: selected.enabledModels,
      },
      audit: {
        algorithmRequested,
        algorithmUsed: `sticky-assignment`,
        fallbackReason: null,
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
