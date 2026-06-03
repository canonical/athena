import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, `..`);
const statusUrl = `http://127.0.0.1:8080/_status/check`;

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
  execFileSync(`docker`, [`compose`, `up`, `-d`, `postgres`, `prepare`, `athena`], {
    cwd: repoRoot,
    stdio: `inherit`,
  });

  await waitForUrl(statusUrl);
};

export default globalSetup;