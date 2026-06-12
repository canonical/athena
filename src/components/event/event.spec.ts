import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

const expectCompletedEventRun = (
  body: {
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
  },
  loopId: string,
  sourceType: string,
  expectedSourceRef: string,
  expectedSourcePayload: Record<string, unknown>,
) => {
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
    jiraItem: `https://jira.example.com/browse/ATH-100`,
    currentStatus: `created`,
    nextOwningPersona: `em.diana`,
  });
  expect(body.events[0]?.approvals).toEqual([{ by: `user`, type: `scope` }]);
};

test(`event creation requires authentication`, async ({ request }) => {
  const response = await request.post(`/api/loop/events`, {
    data: {
      loop: `00000000-0000-7000-8000-000000000000`,
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-100`,
      requestedOutcome: `Implement the loop skeleton`,
    },
  });

  expect(response.status()).toBe(401);
});

test(`event list requires authentication`, async ({ request }) => {
  const response = await request.get(`/api/loop/events`);

  expect(response.status()).toBe(401);
});

test(`github events complete through an existing loop`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `GitHub loop`);

  const payload = {
    repository: `canonical/athena`,
    action: `opened`,
    pullRequest: 42,
    title: `Implement the loop`,
  };
  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-100`,
      requestedOutcome: `Implement the loop skeleton`,
      approvals: [{ by: `user`, type: `scope` }],
      payload,
    },
  });

  expect(response.status()).toBe(201);

  expectCompletedEventRun(
    (await response.json()) as {
      loop: { id: string };
      events: Array<{
        loop: string;
        sourceType: string;
        sourceRef: string | null;
        status: string;
        assignee: string | null;
        emittedByPersona: string | null;
        approvals: unknown[];
        payload: { source?: Record<string, unknown>; handoff?: Record<string, unknown>; note?: string };
        completedAt: string | null;
      }>;
    },
    loop.id,
    `github`,
    `canonical/athena#42`,
    payload,
  );
});

test(`jira events complete through an existing loop`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Jira loop`);

  const payload = {
    issueKey: `ATH-123`,
    transition: `in-progress`,
    summary: `Implement the loop skeleton`,
  };
  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-100`,
      requestedOutcome: `Implement the loop skeleton`,
      approvals: [{ by: `user`, type: `scope` }],
      payload,
    },
  });

  expect(response.status()).toBe(201);

  expectCompletedEventRun(
    (await response.json()) as {
      loop: { id: string };
      events: Array<{
        loop: string;
        sourceType: string;
        sourceRef: string | null;
        status: string;
        assignee: string | null;
        emittedByPersona: string | null;
        approvals: unknown[];
        payload: { source?: Record<string, unknown>; handoff?: Record<string, unknown>; note?: string };
        completedAt: string | null;
      }>;
    },
    loop.id,
    `jira`,
    `ATH-123`,
    payload,
  );
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
      workItemUrl: `https://jira.example.com/browse/ATH-100`,
      requestedOutcome: `Implement the loop skeleton`,
      approvals: [{ by: `user`, type: `scope` }],
      payload,
    },
  });

  expect(response.status()).toBe(201);

  expectCompletedEventRun(
    (await response.json()) as {
      loop: { id: string };
      events: Array<{
        loop: string;
        sourceType: string;
        sourceRef: string | null;
        status: string;
        assignee: string | null;
        emittedByPersona: string | null;
        approvals: unknown[];
        payload: { source?: Record<string, unknown>; handoff?: Record<string, unknown>; note?: string };
        completedAt: string | null;
      }>;
    },
    loop.id,
    `human-chat`,
    `support-room`,
    payload,
  );
});

test(`events respect explicitly assigned personas`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Assigned events loop`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      assignedPersona: `ic.clara`,
      workItemUrl: `https://jira.example.com/browse/ATH-200`,
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

test(`events reject unknown source types`, async ({ page }) => {
  await authenticate(page);
  const loop = await createLoop(page, `Unknown event source loop`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `manual-override`,
      workItemUrl: `https://jira.example.com/browse/ATH-300`,
      requestedOutcome: `Reject an unsupported loop source`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: `sourceType must be one of: github, jira, human-chat.`,
  });
});

test(`events reject missing loops`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-301`,
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
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-401`,
      requestedOutcome: `Handle the first event`,
      payload: {
        issueKey: `ATH-401`,
        transition: `in-progress`,
        summary: `Handle the first event`,
      },
    },
  });
  expect(firstResponse.status()).toBe(201);

  const secondResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-402`,
      requestedOutcome: `Handle the second event`,
      payload: {
        issueKey: `ATH-402`,
        transition: `in-review`,
        summary: `Handle the second event`,
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
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-400`,
      requestedOutcome: `List events for the current loop member`,
      payload: {
        repository: `canonical/athena`,
        action: `opened`,
        pullRequest: 99,
        title: `List events test`,
      },
    },
  });

  const listResponse = await page.request.get(`http://athena.localhost/api/loop/events`);

  expect(listResponse.status()).toBe(200);

  const events = (await listResponse.json()) as Array<{
    loop: string;
    status: string;
    workItemUrl: string | null;
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
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-500`,
      requestedOutcome: `Visible in events UI`,
      payload: {
        issueKey: `ATH-500`,
        transition: `in-progress`,
        summary: `Visible in events UI`,
      },
    },
  });

  await page.goto(`http://athena.localhost/events`);

  await expect(page.getByRole(`heading`, { name: `Events` })).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByText(`Completed`).first()).toBeVisible();
});
