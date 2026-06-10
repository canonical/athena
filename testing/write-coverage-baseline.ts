import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const currentSummaryPath = process.argv[2] ?? `./testing/results/coverage/coverage-summary.json`;
const baselinePath = process.argv[3] ?? `./testing/coverage-baseline.json`;

const currentSummary = JSON.parse(readFileSync(currentSummaryPath, `utf8`));
const total = currentSummary.total ?? {};

const nextTotal = {
  lines: { pct: Number(total?.lines?.pct ?? 0) },
  statements: { pct: Number(total?.statements?.pct ?? 0) },
  functions: { pct: Number(total?.functions?.pct ?? 0) },
  branches: { pct: Number(total?.branches?.pct ?? 0) },
};

let previous: { generatedAt?: string; total?: typeof nextTotal } | undefined;

try {
  previous = JSON.parse(readFileSync(baselinePath, `utf8`));
} catch {
  previous = undefined;
}

const hasCoverageChanged = JSON.stringify(previous?.total ?? {}) !== JSON.stringify(nextTotal);

if (!hasCoverageChanged && previous) {
  console.log(`Coverage totals unchanged; baseline left as-is at ${baselinePath}`);
  process.exit(0);
}

const baseline = {
  generatedAt: new Date().toISOString(),
  total: nextTotal,
};

mkdirSync(path.dirname(baselinePath), { recursive: true });
writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Wrote baseline to ${baselinePath}`);
