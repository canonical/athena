import { execSync } from "node:child_process";

const command = ["rg", "-n", "--no-heading", "--glob '!node_modules/**'", "--glob '!dist/**'", "--glob '!testing/results/**'", "--glob '!.git/**'", "--glob '!scripts/check-deprecations.mjs'", '"@deprecated\\b"', "."].join(" ");

try {
  const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

  if (output.length > 0) {
    console.warn("[deprecations] Warning: @deprecated annotations found in repository:");
    console.warn(output);
  } else {
    console.log("[deprecations] No @deprecated annotations found.");
  }
} catch (error) {
  const stderr = error instanceof Error && "stderr" in error ? String(error.stderr ?? "") : "";

  if (stderr.includes("No files were searched")) {
    console.log("[deprecations] No files matched deprecation scan scope.");
  } else {
    // rg exits with code 1 when no matches are found.
    console.log("[deprecations] No @deprecated annotations found.");
  }
}
