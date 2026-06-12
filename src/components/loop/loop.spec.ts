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

test(`each loop run produces a distinct loop`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Distinct loops project`);

  const post = (workItemUrl: string) =>
    page.request.post(`http://athena.localhost/api/loop/events`, {
      data: {
        project: project.id,
        sourceType: `jira`,
        workItemUrl,
        requestedOutcome: `Distinct loop test`,
        payload: { issueKey: workItemUrl.split(`/`).at(-1), transition: `in-progress`, summary: `Distinct loop test` },
      },
    });

  const [r1, r2] = await Promise.all([post(`https://jira.example.com/browse/ATH-601`), post(`https://jira.example.com/browse/ATH-602`)]);

  const b1 = (await r1.json()) as { loop: { id: string; project: string } };
  const b2 = (await r2.json()) as { loop: { id: string; project: string } };

  expect(b1.loop.id).not.toBe(b2.loop.id);
  expect(b1.loop.project).toBe(project.id);
  expect(b2.loop.project).toBe(project.id);
});

test(`loop page shows events in the UI`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Loop page project`);

  await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      project: project.id,
      sourceType: `jira`,
      workItemUrl: `https://jira.example.com/browse/ATH-500`,
      requestedOutcome: `Visible in loop UI`,
      payload: {
        issueKey: `ATH-500`,
        transition: `in-progress`,
        summary: `Visible in loop UI`,
      },
    },
  });

  await page.goto(`http://athena.localhost/loop`);

  await expect(page.getByRole(`heading`, { name: `Loop events` })).toBeVisible();
  await expect(page.getByRole(`grid`)).toBeVisible();
  await expect(page.getByText(`Completed`).first()).toBeVisible();
});

test(`loop events require authentication`, async ({ request }) => {
  const fakeProjectId = `00000000-0000-7000-8000-000000000000`;
  const [createResponse, listResponse] = await Promise.all([
    request.post(`/api/loop/events`, {
      data: {
        project: fakeProjectId,
        sourceType: `github`,
        workItemUrl: `https://jira.example.com/browse/ATH-100`,
        requestedOutcome: `Implement the loop skeleton`,
      },
    }),
    request.get(`/api/loop/events`),
  ]);

  expect(createResponse.status()).toBe(401);
  expect(listResponse.status()).toBe(401);
});

test(`events reject unknown source types`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Unknown source project`);

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

test(`events reject missing projects`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-301`,
      requestedOutcome: `Reject a loop without a project`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `project is required.` });
});

test(`events respect explicitly assigned personas`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Assigned persona project`);

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

test(`GET events returns events for the authenticated user projects`, async ({ page }) => {
  await authenticate(page);
  const project = await createProject(page, `Events list project`);

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
