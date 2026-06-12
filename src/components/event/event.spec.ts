import { authenticate, dexEmail, expect, test } from "../../../testing/playwright/index.js";

const createProject = async (page: Parameters<typeof authenticate>[0], name: string) => {
  const response = await page.request.post(`http://athena.localhost/api/projects`, {
    data: {
      name,
      description: `${name} description`,
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string };
};

const sourceFixtures = [
  {
    sourceType: `github`,
    payload: {
      repository: `canonical/athena`,
      action: `opened`,
      pullRequest: 42,
      title: `Implement the loop`,
    },
    expectedSourceRef: `canonical/athena#42`,
  },
  {
    sourceType: `jira`,
    payload: {
      issueKey: `ATH-123`,
      transition: `in-progress`,
      summary: `Implement the loop skeleton`,
    },
    expectedSourceRef: `ATH-123`,
  },
  {
    sourceType: `human-chat`,
    payload: {
      author: `Casey`,
      channel: `support-room`,
      message: `Please finish the loop skeleton.`,
    },
    expectedSourceRef: `support-room`,
  },
] as const;

test(`event creation requires authentication`, async ({ request }) => {
  const response = await request.post(`/api/loop/events`, {
    data: {
      project: `00000000-0000-7000-8000-000000000000`,
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

for (const sourceFixture of sourceFixtures) {
  test(`${sourceFixture.sourceType} mock events complete through the loop`, async ({ page }) => {
    await authenticate(page);
    const project = await createProject(page, `${sourceFixture.sourceType} project`);

    const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
      data: {
        project: project.id,
        sourceType: sourceFixture.sourceType,
        workItemUrl: `https://jira.example.com/browse/ATH-100`,
        requestedOutcome: `Implement the loop skeleton`,
        approvals: [{ by: `user`, type: `scope` }],
        payload: sourceFixture.payload,
      },
    });

    expect(response.status()).toBe(201);

    const body = (await response.json()) as {
      loop: { id: string; project: string; name: string };
      events: Array<{
        loop: string;
        user: string;
        sourceType: string;
        sourceRef: string | null;
        status: string;
        assignee: string | null;
        emittedByPersona: string | null;
        approvals: unknown[];
        payload: {
          source?: Record<string, unknown>;
          handoff?: Record<string, unknown>;
          mock?: Record<string, unknown>;
        };
        completedAt: string | null;
      }>;
      finalEvent: { status: string };
    };

    expect(body.finalEvent.status).toBe(`completed`);
    expect(body.loop).toBeDefined();
    expect(body.loop.project).toBe(project.id);
    expect(body.events).toHaveLength(3);
    expect(body.events.map((event) => event.status)).toEqual([`created`, `routed`, `completed`]);
    expect(body.events[0]?.loop).toBe(body.loop.id);
    expect(body.events[0]?.user).toBe(dexEmail);
    expect(body.events[1]?.user).toBe(dexEmail);
    expect(body.events[2]?.user).toBe(dexEmail);
    expect(body.events[0]?.sourceType).toBe(sourceFixture.sourceType);
    expect(body.events[0]?.sourceRef).toBe(sourceFixture.expectedSourceRef);
    expect(body.events[0]?.assignee).toBeNull();
    expect(body.events[1]?.emittedByPersona).toBe(`em.diana`);
    expect(body.events[1]?.assignee).not.toBeNull();
    expect(body.events[1]?.assignee).not.toBe(`em.diana`);
    expect(body.events[1]?.assignee).toBe(body.events[2]?.assignee);
    expect(body.events[2]?.completedAt).not.toBeNull();
    expect(body.events[2]?.payload.mock?.note).toContain(`completed the active responsibility`);
    expect(body.events[0]?.payload.source).toMatchObject(sourceFixture.payload);
    expect(body.events[0]?.payload.handoff).toMatchObject({
      jiraItem: `https://jira.example.com/browse/ATH-100`,
      currentStatus: `created`,
      nextOwningPersona: `em.diana`,
    });
    expect(body.events[0]?.approvals).toEqual([{ by: `user`, type: `scope` }]);
  });
}

test(`events respect explicitly assigned personas`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Assigned events project`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      project: project.id,
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
    loop: { id: string; project: string };
    events: Array<{
      status: string;
      assignee: string | null;
      emittedByPersona: string | null;
    }>;
    finalEvent: { status: string };
  };

  expect(body.finalEvent.status).toBe(`completed`);
  expect(body.loop).toBeDefined();
  expect(body.loop.project).toBe(project.id);
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
  const project = await createProject(page, `Unknown event source project`);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      project: project.id,
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

test(`GET events returns events for the authenticated user`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Listed events project`);

  await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      project: project.id,
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-400`,
      requestedOutcome: `List events for the current user`,
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
    user: string;
    status: string;
    workItemUrl: string | null;
  }>;

  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((event) => event.user === dexEmail)).toBe(true);
  expect(events.every((event) => typeof event.loop === `string`)).toBe(true);
});
