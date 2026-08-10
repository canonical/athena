import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import {
  queryLoopWorkgraphId,
  queryLoopWorkgraphWebhookCreate,
  queryLoopWorkgraphWebhookDelete,
  queryLoopWorkgraphWebhookList,
  queryLoopWorkgraphWebhookUpdate,
  queryWebhookByReceiverId,
  queryWebhookItemCreate,
} from "@components/workgraph/workgraph.pg.service.js";
import { v7 as uuidv7 } from "uuid";
import { WebhookForbiddenError, WebhookNotFoundError, WebhookUnauthorizedError, WebhookValidationError } from "./webhook.errors.js";
import { triggerWebhookItemProcessor } from "./webhook.processor.js";
import type { LoopWorkgraphWebhook, LoopWorkgraphWebhookCreate, LoopWorkgraphWebhookCreateResult, LoopWorkgraphWebhookUpdate } from "./webhook.schema.js";

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new WebhookValidationError(`loopId must be a valid UUID.`);
  }
};

const validateWorkgraphId = (workgraphId: string): void => {
  if (!isValidUuid(workgraphId)) {
    throw new WebhookValidationError(`workgraphId must be a valid UUID.`);
  }
};

const validateWebhookId = (webhookId: string): void => {
  if (!isValidUuid(webhookId)) {
    throw new WebhookValidationError(`webhookId must be a valid UUID.`);
  }
};

const hashSecret = (secret: string): string => createHash(`sha256`).update(secret).digest(`hex`);

const isSecretMatch = (provided: string, expectedHash: string): boolean => {
  const providedHash = hashSecret(provided);
  const left = Buffer.from(providedHash, `utf8`);
  const right = Buffer.from(expectedHash, `utf8`);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

const normalizeRequestHeaders = (headers: Record<string, string | string[] | undefined>): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === `string`) {
      normalized[name.toLowerCase()] = value;
      continue;
    }

    if (Array.isArray(value)) {
      normalized[name.toLowerCase()] = value.join(`, `);
    }
  }

  return normalized;
};

export const loopWorkgraphWebhookList = async (loopId: string, workgraphId: string, userId: string): Promise<LoopWorkgraphWebhook[]> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new WebhookNotFoundError(`Loop not found.`);
  }

  const loopWorkgraphId = await queryLoopWorkgraphId(loopId, workgraphId);

  if (!loopWorkgraphId) {
    throw new WebhookNotFoundError(`Loop workgraph not found.`);
  }

  return queryLoopWorkgraphWebhookList(loopWorkgraphId);
};

export const loopWorkgraphWebhookCreate = async (loopId: string, workgraphId: string, userId: string, input: LoopWorkgraphWebhookCreate): Promise<LoopWorkgraphWebhookCreateResult> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new WebhookNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new WebhookForbiddenError(`Only loop admins may manage webhooks.`);
  }

  const loopWorkgraphId = await queryLoopWorkgraphId(loopId, workgraphId);

  if (!loopWorkgraphId) {
    throw new WebhookNotFoundError(`Loop workgraph not found.`);
  }

  const secret = randomBytes(24).toString(`base64url`);
  const webhook = await queryLoopWorkgraphWebhookCreate({
    loopWorkgraphId,
    label: input.label.trim(),
    receiverId: uuidv7(),
    authHeaderName: input.authHeaderName.trim(),
    authSecretHash: hashSecret(secret),
  });

  return {
    ...webhook,
    secret,
  };
};

export const loopWorkgraphWebhookUpdate = async (loopId: string, workgraphId: string, webhookId: string, userId: string, input: LoopWorkgraphWebhookUpdate): Promise<LoopWorkgraphWebhook> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);
  validateWebhookId(webhookId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new WebhookNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new WebhookForbiddenError(`Only loop admins may manage webhooks.`);
  }

  const loopWorkgraphId = await queryLoopWorkgraphId(loopId, workgraphId);

  if (!loopWorkgraphId) {
    throw new WebhookNotFoundError(`Loop workgraph not found.`);
  }

  const updated = await queryLoopWorkgraphWebhookUpdate(webhookId, loopWorkgraphId, {
    label: input.label?.trim(),
    authHeaderName: input.authHeaderName?.trim(),
    active: input.active,
  });

  if (!updated) {
    throw new WebhookNotFoundError(`Webhook not found.`);
  }

  return updated;
};

export const loopWorkgraphWebhookDelete = async (loopId: string, workgraphId: string, webhookId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateWorkgraphId(workgraphId);
  validateWebhookId(webhookId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new WebhookNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new WebhookForbiddenError(`Only loop admins may manage webhooks.`);
  }

  const loopWorkgraphId = await queryLoopWorkgraphId(loopId, workgraphId);

  if (!loopWorkgraphId) {
    throw new WebhookNotFoundError(`Loop workgraph not found.`);
  }

  if (!(await queryLoopWorkgraphWebhookDelete(webhookId, loopWorkgraphId))) {
    throw new WebhookNotFoundError(`Webhook not found.`);
  }
};

export const webhookInboundReceive = async (receiverId: string, headers: Record<string, string | string[] | undefined>, body: unknown): Promise<void> => {
  const webhook = await queryWebhookByReceiverId(receiverId);

  if (!webhook?.active) {
    throw new WebhookNotFoundError(`Webhook not found.`);
  }

  const normalizedHeaders = normalizeRequestHeaders(headers);
  const headerName = webhook.authHeaderName.toLowerCase();
  const providedSecret = normalizedHeaders[headerName];

  if (!providedSecret || !isSecretMatch(providedSecret, webhook.authSecretHash)) {
    throw new WebhookUnauthorizedError(`Webhook authentication failed.`);
  }

  await queryWebhookItemCreate({
    receiverId,
    headers: normalizedHeaders,
    body,
  });

  console.log(`[webhook][ingest] accepted and enqueued`, {
    receiverId,
    webhookId: webhook.id,
    type: webhook.type,
    loopId: webhook.loop,
    workgraphId: webhook.workgraph,
  });

  triggerWebhookItemProcessor();
};
