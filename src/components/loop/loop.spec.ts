import { expect, type Page, test } from "../../../testing/playwright/index.js";

const dexEmail = `dev.user@canonical.com`;
const dexPassword = `password`;

const signInWithDex = async (page: Page) => {
  const loginInput = page.locator(`input[name=login], input[type=email]`).first();
  const passwordInput = page.locator(`input[name=password], input[type=password]`).first();
  const emailLoginAction = page.locator(`button:has-text("Log in with Email"), a:has-text("Log in with Email")`).first();

  await expect(loginInput.or(emailLoginAction)).toBeVisible();

  if (await emailLoginAction.isVisible()) {
    await emailLoginAction.click();
  }

  await loginInput.fill(dexEmail);
  await passwordInput.fill(dexPassword);
  await page.locator(`button[type=submit], input[type=submit]`).first().click();
};

const authenticate = async (page: Page) => {
  await page.context().clearCookies();
  await page.goto(`http://athena.localhost/authentication`);
  await page.getByRole(`link`, { name: `Sign in` }).click();
  await signInWithDex(page);
  await expect(page).toHaveURL(/athena\.localhost\/(?:authentication)?$/);
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

test(`loop events require authentication`, async ({ request }) => {
  const response = await request.post(`/api/loop/events`, {
    data: {
      sourceType: `github`,
      workItemUrl: `https://jira.example.com/browse/ATH-100`,
      requestedOutcome: `Implement the loop skeleton`,
    },
  });

  expect(response.status()).toBe(401);
});

for (const sourceFixture of sourceFixtures) {
  test(`${sourceFixture.sourceType} mock events complete through the loop`, async ({ page }) => {
    await authenticate(page);

    const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
      data: {
        sourceType: sourceFixture.sourceType,
        workItemUrl: `https://jira.example.com/browse/ATH-100`,
        requestedOutcome: `Implement the loop skeleton`,
        approvals: [{ by: `user`, type: `scope` }],
        payload: sourceFixture.payload,
      },
    });

    expect(response.status()).toBe(201);

    const body = (await response.json()) as {
      outcome: string;
      events: Array<{
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
    };

    expect(body.outcome).toBe(`completed`);
    expect(body.events).toHaveLength(3);
    expect(body.events.map((event) => event.status)).toEqual([`created`, `routed`, `completed`]);
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

test(`loop events respect explicitly assigned personas`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
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
    outcome: string;
    events: Array<{
      status: string;
      assignee: string | null;
      emittedByPersona: string | null;
    }>;
  };

  expect(body.outcome).toBe(`completed`);
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

test(`loop events reject unknown source types`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
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
