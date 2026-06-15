import { getPool } from "@components/postgres/postgres.js";
import type { Event, EventInsert } from "./event.schema.js";

const eventColumnNames = [`id`, `loop`, `sourceType`, `sourceRef`, `status`, `assignee`, `requestedOutcome`, `emittedByPersona`, `blocker`, `approvals`, `payload`, `emittedAt`, `completedAt`, `updatedAt`] as const;
const getEventColumns = (tableAlias?: string): string => eventColumnNames.map((column) => `${tableAlias ? `${tableAlias}.` : ``}"${column}"`).join(`, `);

export const queryEventCreate = async (event: EventInsert): Promise<Event> => {
  const result = await getPool().query<Event>(
    `
      INSERT INTO "event" (
        "loop",
        "sourceType",
        "sourceRef",
        "status",
        "assignee",
        "requestedOutcome",
        "emittedByPersona",
        "blocker",
        "approvals",
        "payload",
        "completedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      RETURNING ${getEventColumns()}
    `,
    [
      event.loop,
      event.sourceType,
      event.sourceRef ?? null,
      event.status,
      event.assignee ?? null,
      event.requestedOutcome,
      event.emittedByPersona,
      event.blocker ?? null,
      JSON.stringify(event.approvals),
      JSON.stringify(event.payload),
      event.completedAt ?? null,
    ],
  );

  const createdEvent = result.rows[0];

  if (!createdEvent) {
    throw new Error(`Event was not created.`);
  }

  return createdEvent;
};

export const queryEventList = async (userId: string): Promise<Event[]> => {
  const result = await getPool().query<Event>(
    `
      SELECT ${getEventColumns(`e`)}
      FROM "event" e
      JOIN "loopUser" lu ON lu."loop" = e."loop"
      WHERE lu."user" = $1
      ORDER BY e."emittedAt" DESC
    `,
    [userId],
  );

  return result.rows;
};
