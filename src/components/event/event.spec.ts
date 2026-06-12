import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

type EventRunBody = {
  loop: { id: string };
  events: Array<{
    loop: string;
    sourceType: string;
    sourceRef: string | null;
    status: string;
    assignee: string | null;
    emittedByPersona: string | null;
    approvals: unknown[];
    payload: {
      source?: Record<string, unknown>;
      handoff?: Record<string, unknown>;
      note?: string;
    };
    completedAt: string | null;
  }>;
};

const expectCompletedEventRun = (body: EventRunBody, loopId: string, sourceType: string, expectedSourceRef: string, expectedSourcePayload: Record<string, unknown>) => {
  expect(body.loop.id).toBe(loopId);
  expect(body.events).toHaveLength(3);
  expect(body.events.map((event) => event.status)).toEqual([`created`, `routed`, `completed`]);
  expect(body.events[0]?.loop).toBe(loopId);
  expect(body.events[0]).not.toHaveProperty(`user`);
  expect(body.events[0]?.sourceType).toBe(sourceType);
  expect(body.events[0]?.sourceRef).toBe(expectedSourceRef);
  expect(body.events[0]?.assignee).toBeNull();
  expect(body.events[1]?.emittedByPersona).toBe(`em.diana`);
  expect(body.events[1]?.assignee).not.toBeNull();
  expect(body.events[1]?.assignee).not.toBe(`em.diana`);
  expect(body.events[1]?.assignee).toBe(body.events[2]?.assignee);
  expect(body.events[2]?.status).toBe(`completed`);
  expect(body.events[2]?.completedAt).not.toBeNull();
  expect(body.events[2]?.payload.note).toContain(`completed the active responsibility`);
  expect(body.events[0]?.payload.source).toMatchObject(expectedSourcePayload);
  expect(body.events[0]?.payload.handoff).toMatchObject({
    currentStatus: `created`,
    nextOwningPersona: `em.diana`,
  });
  expect(body.events[0]?.approvals).toEqual([{ by: `user`, type: `scope` }]);
};

test(`event creation requires authentication`, async ({ request }) => {
  const response = await request.post(`/api/loop/events`, {
    data: {
      loop: `00000000-0000-7000-8000-000000000000`,
      sourceType: `custom-webhook`,
      requestedOutcome: `Implement the loop skeleton`,
    },
  });

  expect(response.status()).toBe(401);
});

test(`event list requires authentication`, async ({ request }) => {
  const response = await request.get(`/api/loop/events`);

  expect(response.status()).toBe(401);
});

test(`custom webhook events complete through an existing loop`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Webhook loop`);

  const payload = {
    repository: `canonical/athena`,
    action: `opened`,
    workItemUrl: `https://tracker.example.com/work-items/ATH-100`,
    topLevelWorkItemUrl: `https://tracker.example.com/epics/ATHENA`,
  };
  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `gitlab-webhook`,
      sourceRef: `canonical/athena!42`,
      requestedOutcome: `Implement the loop skeleton`,
      approvals: [{ by: `user`, type: `scope` }],
      payload,
    },
  });

  expect(response.status()).toBe(201);

  expectCompletedEventRun((await response.json()) as EventRunBody, loop.id, `gitlab-webhook`, `canonical/athena!42`, {
    sourceType: `gitlab-webhook`,
    sourceRef: `canonical/athena!42`,
    ...payload,
  });
});

test(`human chat events complete through an existing loop`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Human chat loop`);

  const payload = {
    author: `Casey`,
    channel: `support-room`,
    message: `Please finish the loop skeleton.`,
  };
  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      requestedOutcome: `Implement the loop skeleton`,
      approvals: [{ by: `user`, type: `scope` }],
      payload,
    },
  });

  expect(response.status()).toBe(201);

  expectCompletedEventRun((await response.json()) as EventRunBody, loop.id, `human-chat`, `support-room`, {
    sourceType: `human-chat`,
    sourceRef: `support-room`,
    ...payload,
  });
});

test(`events respect explicitly assigned personas`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Assigned events loop`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      assignedPersona: `ic.clara`,
      requestedOutcome: `Respond to the assigned human chat event`,
      payload: {
        author: `Jordan`,
        channel: `design-room`,
        message: `Please complete the assigned task.`,
      },
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as {
    loop: { id: string };
    events: Array<{
      status: string;
      assignee: string | null;
      emittedByPersona: string | null;
    }>;
  };

  expect(body.loop.id).toBe(loop.id);
  expect(body.events).toHaveLength(3);
  expect(body.events[1]).toMatchObject({
    status: `routed`,
    assignee: `ic.clara`,
    emittedByPersona: `athena`,
  });
  expect(body.events[2]).toMatchObject({
    status: `completed`,
    assignee: `ic.clara`,
    emittedByPersona: `ic.clara`,
  });
});

test(`events accept custom source types without fixed tracker fields`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Custom source loop`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `zendesk-webhook`,
      sourceRef: `ticket-300`,
      requestedOutcome: `Handle a custom webhook`,
      payload: {
        severity: `high`,
      },
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as EventRunBody;
  expect(body.events[0]).toMatchObject({
    sourceType: `zendesk-webhook`,
    sourceRef: `ticket-300`,
  });
});

test(`events reject missing loops`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      sourceType: `custom-webhook`,
      requestedOutcome: `Reject an event without a loop`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `loop is required.` });
});

test(`loops accept new events after previous work completed`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Long lived loop`);

  const firstResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `customer-webhook`,
      sourceRef: `event-401`,
      requestedOutcome: `Handle the first event`,
      payload: {
        workItemUrl: `https://tracker.example.com/work-items/ATH-401`,
      },
    },
  });
  expect(firstResponse.status()).toBe(201);

  const secondResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `customer-webhook`,
      sourceRef: `event-402`,
      requestedOutcome: `Handle the second event`,
      payload: {
        workItemUrl: `https://tracker.example.com/work-items/ATH-402`,
      },
    },
  });
  expect(secondResponse.status()).toBe(201);

  const secondBody = (await secondResponse.json()) as {
    loop: { id: string };
    events: Array<{ loop: string; status: string; requestedOutcome: string | null }>;
  };
  expect(secondBody.loop.id).toBe(loop.id);
  expect(secondBody.events).toHaveLength(3);
  expect(secondBody.events[2]?.status).toBe(`completed`);

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/events`);
  expect(listResponse.status()).toBe(200);
  const events = (await listResponse.json()) as Array<{ loop: string; requestedOutcome: string | null }>;
  expect(events.filter((event) => event.loop === loop.id && event.requestedOutcome === `Handle the first event`)).toHaveLength(3);
  expect(events.filter((event) => event.loop === loop.id && event.requestedOutcome === `Handle the second event`)).toHaveLength(3);
});

test(`GET events returns events for the authenticated user loops`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Listed events loop`);

  await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `custom-webhook`,
      sourceRef: `event-400`,
      requestedOutcome: `List events for the current loop member`,
      payload: {
        workItemUrl: `https://tracker.example.com/work-items/ATH-400`,
      },
    },
  });

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/events`);

  expect(listResponse.status()).toBe(200);

  const events = (await listResponse.json()) as Array<{
    loop: string;
    status: string;
    payload: Record<string, unknown>;
  }>;

  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThan(0);
  expect(events.some((event) => event.loop === loop.id)).toBe(true);
  expect(events.every((event) => typeof event.loop === `string`)).toBe(true);
  expect(events.every((event) => !(`user` in event))).toBe(true);
});

test(`events page shows events in the UI`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Events page loop`);

  await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `customer-webhook`,
      sourceRef: `event-500`,
      requestedOutcome: `Visible in events UI`,
      payload: {
        workItemUrl: `https://tracker.example.com/work-items/ATH-500`,
      },
    },
  });

  await page.goto(`http://athena.localhost/events`);

  await expect(page.getByRole(`heading`, { name: `Events` })).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByText(`Completed`).first()).toBeVisible();
});
