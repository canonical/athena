import { Client } from "pg";
import { authenticate, createLoop, expect, test } from "../../../testing/playwright/index.js";

const defaultDbConnectionString = `postgresql://athena:${process.env.POSTGRES_PASSWORD || `athena`}@localhost:5432/athena`;
const dbConnectionString = defaultDbConnectionString;
const currentUserId = `dev.user@canonical.com`;

const withDb = async <T>(operation: (client: Client) => Promise<T>): Promise<T> => {
  const client = new Client({ connectionString: dbConnectionString });
  await client.connect();

  try {
    return await operation(client);
  } finally {
    await client.end();
  }
};

test(`provider and harness routes require authentication`, async ({ request }) => {
  const [providerList, harnessList] = await Promise.all([request.get(`/api/provider-definition-list`), request.get(`/api/harness-definition-list`)]);

  expect(providerList.status()).toBe(401);
  expect(harnessList.status()).toBe(401);
});

test(`provider definitions enforce OpenRouter-only and HTTPS-only`, async ({ page }) => {
  await authenticate(page);

  const invalidTypeResponse = await page.request.post(`http://athena.localhost/api/provider-definition-list`, {
    data: {
      displayName: `Invalid type provider`,
      providerType: `other`,
      baseUrl: `https://openrouter.ai/api/v1`,
      model: `openai/gpt-4.1-mini`,
      apiKey: `test-key`,
    },
  });
  expect(invalidTypeResponse.status()).toBe(400);

  const invalidHttpsResponse = await page.request.post(`http://athena.localhost/api/provider-definition-list`, {
    data: {
      displayName: `Invalid https provider`,
      providerType: `openrouter`,
      baseUrl: `http://openrouter.ai/api/v1`,
      model: `openai/gpt-4.1-mini`,
      apiKey: `test-key`,
    },
  });
  expect(invalidHttpsResponse.status()).toBe(400);
  await expect(invalidHttpsResponse.json()).resolves.toEqual({ error: `baseUrl must use HTTPS.` });
});

test(`definition responses redact credential material`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/provider-definition-list`, {
    data: {
      displayName: `OpenRouter Secret Provider ${Date.now()}`,
      providerType: `openrouter`,
      baseUrl: `https://openrouter.ai/api/v1`,
      model: `openai/gpt-4.1-mini`,
      apiKey: `sk-openrouter-sensitive-value`,
    },
  });

  expect(response.status()).toBe(201);
  const created = (await response.json()) as Record<string, unknown>;
  expect(created.hasCredential).toBe(true);
  expect(created).not.toHaveProperty(`apiKey`);
  expect(created).not.toHaveProperty(`credentialCiphertext`);
  expect(created).not.toHaveProperty(`credentialIv`);
  expect(created).not.toHaveProperty(`credentialAuthTag`);
});

test(`harness definitions enforce MVP harness policy at save time`, async ({ page }) => {
  await authenticate(page);

  const response = await page.request.post(`http://athena.localhost/api/harness-definition-list`, {
    data: {
      displayName: `Non-mvp harness`,
      workerType: `openai-codex`,
      apiKey: `copilot-key`,
      lifecycleStatus: `active`,
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `Only github-copilot-cloud-agent is executable in MVP.` });
});

test(`owner-scoped definition mutation blocks non-owners`, async ({ page }) => {
  await authenticate(page);

  const otherHarness = await withDb(async (client) => {
    await client.query(
      `
        INSERT INTO "user" ("id", "subject", "name", "picture")
        VALUES ('other.user@canonical.com', 'other-user-subject', 'Other User', '')
        ON CONFLICT ("id") DO NOTHING
      `,
    );

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO "harnessDefinition" (
          "owner",
          "displayName",
          "workerType",
          "credentialCiphertext",
          "credentialIv",
          "credentialAuthTag",
          "credentialKeyVersion",
          "lifecycleStatus"
        )
        VALUES ($1, $2, 'github-copilot-cloud-agent', 'x', 'y', 'z', 'v1', 'active')
        RETURNING "id"
      `,
      [`other.user@canonical.com`, `Other owner harness ${Date.now()}`],
    );

    return result.rows[0]?.id;
  });

  expect(otherHarness).toBeDefined();

  const response = await page.request.put(`http://athena.localhost/api/harness-definition/${otherHarness}`, {
    data: {
      displayName: `Attempted update`,
      lifecycleStatus: `active`,
    },
  });

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: `Harness definition not found.` });
});

test(`loop members can assign definitions but non-admins cannot mutate priority overrides`, async ({ page }) => {
  await authenticate(page);

  const providerCreate = await page.request.post(`http://athena.localhost/api/provider-definition-list`, {
    data: {
      displayName: `Assignment provider ${Date.now()}`,
      providerType: `openrouter`,
      baseUrl: `https://openrouter.ai/api/v1`,
      model: `openai/gpt-4.1-mini`,
      apiKey: `member-assignment-key`,
    },
  });
  expect(providerCreate.status()).toBe(201);
  const providerDefinition = (await providerCreate.json()) as { id: string };

  const nonAdminLoopId = await withDb(async (client) => {
    const loopResult = await client.query<{ id: string }>(`INSERT INTO "loop" ("name", "description") VALUES ($1, $2) RETURNING "id"`, [`Non-admin assignment loop ${Date.now()}`, `loop for permissions check`]);
    const loopId = loopResult.rows[0]?.id;

    if (!loopId) {
      throw new Error(`Expected loop id.`);
    }

    await client.query(`INSERT INTO "loopUser" ("loop", "user", "isAdmin") VALUES ($1, $2, FALSE)`, [loopId, currentUserId]);

    return loopId;
  });

  const assignResponse = await page.request.post(`http://athena.localhost/api/loop/${nonAdminLoopId}/provider-assignment-list`, {
    data: { providerDefinition: providerDefinition.id },
  });
  expect(assignResponse.status()).toBe(204);

  const adminUpdateResponse = await page.request.put(`http://athena.localhost/api/loop/${nonAdminLoopId}/provider-assignment/${providerDefinition.id}/admin`, {
    data: { priorityOverride: 1 },
  });
  expect(adminUpdateResponse.status()).toBe(403);
  await expect(adminUpdateResponse.json()).resolves.toEqual({ error: `Only loop admins may edit priority and overrides.` });
});

test(`selection algorithms are deterministic and rotate under round robin`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Selection algorithm loop`);

  const [providerAResponse, providerBResponse] = await Promise.all([
    page.request.post(`http://athena.localhost/api/provider-definition-list`, {
      data: {
        displayName: `OpenRouter Round Robin A ${loop.id}`,
        providerType: `openrouter`,
        baseUrl: `https://openrouter.ai/api/v1`,
        model: `openai/gpt-4.1-mini`,
        apiKey: `openrouter-a-key`,
      },
    }),
    page.request.post(`http://athena.localhost/api/provider-definition-list`, {
      data: {
        displayName: `OpenRouter Round Robin B ${loop.id}`,
        providerType: `openrouter`,
        baseUrl: `https://openrouter.ai/api/v1`,
        model: `openai/gpt-4.1-mini`,
        apiKey: `openrouter-b-key`,
      },
    }),
  ]);

  expect(providerAResponse.status()).toBe(201);
  expect(providerBResponse.status()).toBe(201);
  const providerA = (await providerAResponse.json()) as { id: string };
  const providerB = (await providerBResponse.json()) as { id: string };

  await page.request.post(`http://athena.localhost/api/loop/${loop.id}/provider-assignment-list`, { data: { providerDefinition: providerA.id } });
  await page.request.post(`http://athena.localhost/api/loop/${loop.id}/provider-assignment-list`, { data: { providerDefinition: providerB.id } });

  const policyResponse = await page.request.put(`http://athena.localhost/api/loop/${loop.id}/selection-policy`, {
    data: {
      openRouterSelectionAlgorithm: `round-robin`,
    },
  });
  expect(policyResponse.status()).toBe(200);

  const firstEventResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      assignedPersona: `pm.alice`,
      requestedOutcome: `Round robin pick one`,
      payload: { message: `first event` },
    },
  });
  expect(firstEventResponse.status()).toBe(201);

  const secondEventResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      assignedPersona: `pm.alice`,
      requestedOutcome: `Round robin pick two`,
      payload: { message: `second event` },
    },
  });
  expect(secondEventResponse.status()).toBe(201);

  const firstBody = (await firstEventResponse.json()) as {
    events: Array<{ payload: { source?: { executionSelection?: { selectedAssignment: string | null; algorithmUsed: string } } } }>;
  };
  const secondBody = (await secondEventResponse.json()) as {
    events: Array<{ payload: { source?: { executionSelection?: { selectedAssignment: string | null; algorithmUsed: string } } } }>;
  };

  const firstSelection = firstBody.events[1]?.payload?.source?.executionSelection;
  const firstCompletionSelection = firstBody.events[2]?.payload?.source?.executionSelection;
  const secondSelection = secondBody.events[1]?.payload?.source?.executionSelection;

  expect(firstSelection?.algorithmUsed).toBe(`round-robin`);
  expect(firstCompletionSelection?.algorithmUsed).toBe(`round-robin`);
  expect(secondSelection?.algorithmUsed).toBe(`round-robin`);
  expect(firstSelection?.selectedAssignment).not.toBeNull();
  expect(firstCompletionSelection?.selectedAssignment).not.toBeNull();
  expect(secondSelection?.selectedAssignment).not.toBeNull();
  expect(firstSelection?.selectedAssignment).not.toBe(firstCompletionSelection?.selectedAssignment);
});

test(`execution hook audits skipped non-mvp harness assignments without leaking keys`, async ({ page }) => {
  await authenticate(page);

  const loop = await createLoop(page, `Execution hook loop`);

  const created = await withDb(async (client) => {
    const harnessResult = await client.query<{ id: string }>(
      `
        INSERT INTO "harnessDefinition" (
          "owner",
          "displayName",
          "workerType",
          "credentialCiphertext",
          "credentialIv",
          "credentialAuthTag",
          "credentialKeyVersion",
          "lifecycleStatus"
        )
        VALUES ($1, $2, 'openai-codex', 'plain-text-should-not-leak', 'iv', 'tag', 'v1', 'active')
        RETURNING "id"
      `,
      [currentUserId, `Inserted non-mvp harness ${Date.now()}`],
    );
    const harnessId = harnessResult.rows[0]?.id;

    if (!harnessId) {
      throw new Error(`Expected harness id.`);
    }

    await client.query(`INSERT INTO "loopHarnessDefinition" ("loop", "harnessDefinition", "priority", "enabled") VALUES ($1, $2, 1, TRUE)`, [loop.id, harnessId]);

    return { harnessId };
  });

  const eventResponse = await page.request.post(`http://athena.localhost/api/loop/events`, {
    data: {
      loop: loop.id,
      sourceType: `human-chat`,
      assignedPersona: `ic.clara`,
      requestedOutcome: `Run copilot selection`,
      payload: { message: `trigger execution hook` },
    },
  });

  expect(eventResponse.status()).toBe(201);

  const body = (await eventResponse.json()) as {
    events: Array<{ payload: { source?: { executionSelection?: { skipped?: Array<{ assignmentId: string; reason: string }> } } } }>;
  };

  const executionSelection = body.events[1]?.payload?.source?.executionSelection;
  expect(executionSelection?.skipped).toEqual(expect.arrayContaining([{ assignmentId: created.harnessId, reason: `non-mvp-harness` }]));

  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(`plain-text-should-not-leak`);
});
