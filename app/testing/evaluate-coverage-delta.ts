import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const currentSummaryPath = process.argv[2] ?? `./testing/output/coverage/coverage-summary.json`;
const baselinePath = process.argv[3] ?? `./testing/coverage-baseline.json`;
const markdownOutputPath = process.argv[4] ?? `./testing/output/coverage/coverage-comment.md`;

const metricNames = ["lines", "statements", "functions", "branches"];

const parseJson = (filePath) => JSON.parse(readFileSync(filePath, `utf8`));

const currentSummary = parseJson(currentSummaryPath);
const baselineSummary = parseJson(baselinePath);

const current = currentSummary.total ?? {};
const baseline = baselineSummary.total ?? {};

const rows = [];
let hasRegression = false;

for (const metricName of metricNames) {
  const currentPct = Number(current?.[metricName]?.pct ?? 0);
  const baselinePct = Number(baseline?.[metricName]?.pct ?? 0);
  const delta = Number((currentPct - baselinePct).toFixed(2));

  if (delta < 0) {
    hasRegression = true;
  }

  rows.push({ metricName, currentPct, baselinePct, delta });
}

const markdown = [
  `<!-- athena-coverage-report -->`,
  `## Coverage Report`,
  ``,
  `| Metric | Baseline % | Current % | Delta |`,
  `| --- | ---: | ---: | ---: |`,
  ...rows.map((row) => {
    const deltaPrefix = row.delta > 0 ? `+` : ``;
    return `| ${row.metricName} | ${row.baselinePct.toFixed(2)} | ${row.currentPct.toFixed(2)} | ${deltaPrefix}${row.delta.toFixed(2)} |`;
  }),
  ``,
  hasRegression ? `Result: regression detected. Current coverage is below baseline for one or more metrics.` : `Result: no regression detected. Current coverage meets or exceeds baseline.`,
  ``,
  `Coverage artifact: see workflow run artifacts (name: athena-coverage-report).`,
].join(`\n`);

mkdirSync(path.dirname(markdownOutputPath), { recursive: true });
writeFileSync(markdownOutputPath, markdown);

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `has_regression=${hasRegression}\n`, { flag: `a` });
  writeFileSync(process.env.GITHUB_OUTPUT, `comment_path=${markdownOutputPath}\n`, { flag: `a` });
}

if (hasRegression) {
  process.exit(1);
}
