import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse as parseUuid, stringify as stringifyUuid, v7 as uuidv7, validate as validateUuid } from "uuid";

const athenaUrl = process.env.ATHENA_URL?.replace(/\/$/, ``);
const runnerToken = process.env.ATHENA_RUNNER_TOKEN;
const instancePath = process.env.ATHENA_RUNNER_INSTANCE_PATH ?? `/var/lib/athena-runner/instance-id`;
const agentVersion = process.env.ATHENA_RUNNER_AGENT_VERSION ?? `development`;
const contractVersion = process.env.ATHENA_RUNNER_CONTRACT_VERSION ?? `v1`;

const getInstanceId = async (): Promise<string> => {
  try {
    const savedInstanceId = (await readFile(instancePath, `utf8`)).trim();
    if (validateUuid(savedInstanceId)) {
      return stringifyUuid(parseUuid(savedInstanceId));
    }
  } catch {}

  const instanceId = uuidv7();
  await mkdir(instancePath.substring(0, instancePath.lastIndexOf(`/`)), { recursive: true });
  await writeFile(instancePath, instanceId, { mode: 0o600 });
  return instanceId;
};

const send = async (path: string, body: Record<string, unknown>, instanceId: string): Promise<void> => {
  if (!athenaUrl || !runnerToken) throw new Error(`ATHENA_URL and ATHENA_RUNNER_TOKEN are required.`);
  const requestBody = JSON.stringify({ ...body, instanceId });
  const response = await fetch(`${athenaUrl}/api/runner-agent/${path}`, {
    method: `POST`,
    headers: {
      Accept: `application/json`,
      Authorization: `Bearer ${runnerToken}`,
      "Content-Type": `application/json`,
    },
    body: requestBody,
  });
  if (!response.ok) throw new Error(`Athena runner request failed with status ${response.status}.`);
};

const main = async (): Promise<void> => {
  const instanceId = await getInstanceId();
  const identity = {
    instanceId,
    name: process.env.ATHENA_RUNNER_NAME ?? instanceId,
    agentVersion,
    contractVersion,
    capabilities: { os: process.platform, architecture: process.arch, harnesses: [`athena-workshop`] },
    capacity: {},
  };

  await send(`connect`, identity, instanceId);
  console.log(`Athena Workshop runner connected as ${instanceId}`);

  const heartbeat = async () => {
    try {
      await send(`heartbeat`, identity, instanceId);
      console.log(`Athena Workshop runner heartbeat ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Athena Workshop runner heartbeat failed`, error);
    }
  };

  const interval = setInterval(() => void heartbeat(), 10_000);
  const stop = () => {
    clearInterval(interval);
    process.exit(0);
  };
  process.once(`SIGTERM`, stop);
  process.once(`SIGINT`, stop);
};

void main().catch((error: unknown) => {
  console.error(`Athena Workshop runner failed to start`, error);
  process.exitCode = 1;
});
