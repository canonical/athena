import { openRouterMessageSchema } from "@components/openrouter/openrouter.schema.js";
import { isoDateTime, nullableString, optionalString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const taskQueueItemInputSchema = z.object({
  type: z.literal(`message`),
  id: uuid().optional(),
  status: z.enum([`pending`, `awaiting-approval`, `approved`, `completed`]).default(`pending`),
  persona: uuid().nullable().optional(),
  value: openRouterMessageSchema,
});

export const taskQueueItemSchema = taskQueueItemInputSchema.extend({
  id: uuid(),
  timestamp: isoDateTime,
});

export const taskQueueCompactionItemSchema = z.object({
  type: z.literal(`compaction`),
  id: uuid(),
  timestamp: isoDateTime,
  itemCount: z.number().int().min(0),
});

export const taskQueueArchiveItemSchema = z.union([taskQueueItemSchema, taskQueueCompactionItemSchema]);

export const taskQueueSchema = z.array(z.union([taskQueueItemSchema]));
export const taskQueueInputSchema = z.array(z.union([taskQueueItemInputSchema]));
export const taskQueueArchiveSchema = z.array(taskQueueArchiveItemSchema);
export const taskSourceSchema = z.enum([`user`, `workgraphItem`]);
export const taskStatusSchema = z.enum([`queued`, `wip`, `completed`]);

export const taskSchema = z.object({
  id: uuid(),
  loop: uuid(),
  currentPersona: uuid().nullable(),
  currentProvider: uuid().nullable(),
  currentModel: nullableString,
  currentObjective: nullableString,
  queueArchive: taskQueueArchiveSchema,
  source: taskSourceSchema,
  status: taskStatusSchema,
  processorUnit: uuid().nullable(),
  processorPingedAt: isoDateTime.nullable(),
  workgraphItem: uuid().nullable(),
  title: optionalString,
  queue: taskQueueSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const taskListParamsSchema = z.object({
  loopId: uuid(`loop must be a valid UUID.`),
});

export const taskDetailParamsSchema = z.object({
  loopId: uuid(`loop must be a valid UUID.`),
  taskId: uuid(`task must be a valid UUID.`),
});

export const taskAppendUserMessageSchema = z.object({
  loopId: uuid(`loop must be a valid UUID.`),
  taskId: uuid(`task must be a valid UUID.`),
  content: z.string().trim().min(1, `message content is required.`),
});

export const taskToolCallApprovalSchema = z.object({
  loopId: uuid(`loop must be a valid UUID.`),
  taskId: uuid(`task must be a valid UUID.`),
  queueItemId: uuid(`queueItemId must be a valid UUID.`),
});

export const taskCreateSchema = taskSchema
  .pick({
    loop: true,
    source: true,
    status: true,
    workgraphItem: true,
    title: true,
    queue: true,
  })
  .partial()
  .required({ loop: true })
  .extend({
    queue: taskQueueInputSchema.optional(),
    status: taskStatusSchema.optional().default(`queued`),
  });

export type Task = z.infer<typeof taskSchema>;
export type TaskQueueItem = z.infer<typeof taskQueueItemSchema>;
export type TaskQueueCompactionItem = z.infer<typeof taskQueueCompactionItemSchema>;
export type TaskQueueArchiveItem = z.infer<typeof taskQueueArchiveItemSchema>;
export type TaskQueueItemInput = z.infer<typeof taskQueueItemInputSchema>;
export type TaskQueue = z.infer<typeof taskQueueSchema>;
export type TaskSource = z.infer<typeof taskSourceSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskListParams = z.infer<typeof taskListParamsSchema>;
export type TaskDetailParams = z.infer<typeof taskDetailParamsSchema>;
export type TaskCreate = z.input<typeof taskCreateSchema>;
export type TaskAppendUserMessage = z.infer<typeof taskAppendUserMessageSchema>;
export type TaskToolCallApproval = z.infer<typeof taskToolCallApprovalSchema>;
