import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { v5 as uuidv5 } from "uuid";
import { testInferenceHealthUrl } from "./playwright/inference.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, `..`);
const statusUrl = `http://athena.localhost/_status/check`;
const frontendUrl = `http://athena.localhost`;
const dexDiscoveryUrl = `${frontendUrl}/dex/.well-known/openid-configuration`;
const authUsersPath = join(workspaceRoot, `testing`, `auth-users.json`);
const dexUsersPath = join(workspaceRoot, `scripts`, `dex-users.yaml`);
const defaultPasswordHash = `$2a$10$2b2cU8CPhOTaGrs1HRQuAueS7JTT5ZHsHSzYiFPm1leZck7Mc8T4W`;
const dexUserNamespace = `dd7f8cc5-1cb4-4237-b29f-d44709f908ec`;

type AuthUser = {
  email: string;
  password: string;
  username?: string;
  userID?: string;
  hash?: string;
};

const parseAuthUsers = (rawValue: string): AuthUser[] => {
  const parsed = JSON.parse(rawValue) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Auth users file must be a JSON array.`);
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== `object`) {
      throw new Error(`Auth user at index ${index} must be an object.`);
    }

    const candidate = entry as Partial<AuthUser>;

    if (!candidate.email || typeof candidate.email !== `string`) {
      throw new Error(`Auth user at index ${index} must include an email.`);
    }

    if (!candidate.password || typeof candidate.password !== `string`) {
      throw new Error(`Auth user at index ${index} must include a password.`);
    }

    return {
      email: candidate.email.trim().toLowerCase(),
      password: candidate.password,
      username: typeof candidate.username === `string` && candidate.username.trim().length > 0 ? candidate.username.trim() : undefined,
      userID: typeof candidate.userID === `string` && candidate.userID.trim().length > 0 ? candidate.userID.trim() : undefined,
      hash: typeof candidate.hash === `string` && candidate.hash.trim().length > 0 ? candidate.hash.trim() : undefined,
    };
  });
};

const resolvePasswordHash = (user: AuthUser): string => {
  if (user.hash) {
    return user.hash;
  }

  if (user.password === `password`) {
    return defaultPasswordHash;
  }

  throw new Error(`Auth user ${user.email} uses a non-default password. Provide a bcrypt hash in auth-users.json as "hash".`);
};

const resolveUsername = (user: AuthUser): string => {
  if (user.username) {
    return user.username;
  }

  return user.email.split(`@`)[0] ?? user.email;
};

const resolveUserId = (user: AuthUser): string => user.userID ?? uuidv5(user.email, dexUserNamespace);

const buildStaticPasswordsBlock = (users: AuthUser[]): string =>
  `staticPasswords:\n${users
    .map((user) => {
      const hash = resolvePasswordHash(user);
      const username = resolveUsername(user);
      const userID = resolveUserId(user);

      return `  - email: ${user.email}\n    hash: ${hash}\n    username: ${username}\n    userID: ${userID}`;
    })
    .join(`\n`)}`;

const renderDexUsers = async (): Promise<void> => {
  const authUsersRaw = await readFile(authUsersPath, `utf8`);
  const authUsers = parseAuthUsers(authUsersRaw);

  if (authUsers.length === 0) {
    throw new Error(`Auth users file is empty. Provide at least one test user.`);
  }

  await writeFile(dexUsersPath, `${buildStaticPasswordsBlock(authUsers)}\n`, `utf8`);
};

const waitForUrl = async (url: string, attempts = 25): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying until the stack is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const globalSetup = async (): Promise<void> => {
  await renderDexUsers();

  const localSeedDir = join(workspaceRoot, `migrations`, `pg`, `seed.local`);
  const localSeedDirHidden = `${localSeedDir}.bak`;

  if (process.env.CI) {
    await rename(localSeedDir, localSeedDirHidden).catch(() => undefined);
  }

  try {
    execFileSync(`docker`, [`compose`, `--profile`, `test`, `down`, `-v`], {
      cwd: workspaceRoot,
      stdio: `inherit`,
    });

    execFileSync(`docker`, [`compose`, `--profile`, `test`, `up`, `-d`, `--build`, `traefik`, `postgres`, `prepare`, `dex`, `test-inference`, `athena`], {
      cwd: workspaceRoot,
      stdio: `inherit`,
    });
  } finally {
    if (process.env.CI) {
      await rename(localSeedDirHidden, localSeedDir).catch(() => undefined);
    }
  }

  await waitForUrl(statusUrl);
  await waitForUrl(dexDiscoveryUrl);
  await waitForUrl(frontendUrl);
  await waitForUrl(testInferenceHealthUrl);
};

export default globalSetup;
