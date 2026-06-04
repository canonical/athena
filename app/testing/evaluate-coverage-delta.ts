import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const currentSummaryPath = process.argv[2] ?? `./testing/output/coverage/coverage-summary.json`;
const baselinePath = process.argv[3] ?? `./testing/coverage-baseline.json`;
const markdownOutputPath = process.argv[4] ?? `./testing/output/coverage/coverage-comment.md`;

const metricNames = ["lines", "statements", "functions", "branches"];

const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;

const appendGithubOutput = (line: string): void => {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  writeFileSync(process.env.GITHUB_OUTPUT, `${line}\n`, { flag: `a` });
};

const parseJson = (filePath: string): unknown => JSON.parse(readFileSync(filePath, `utf8`));

try {
  const currentSummary = parseJson(currentSummaryPath) as { total?: Record<string, { pct?: number }> };
  const baselineSummary = parseJson(baselinePath) as { total?: Record<string, { pct?: number }> };

  const current = currentSummary.total ?? {};
  const baseline = baselineSummary.total ?? {};

  const rows: Array<{ metricName: string; currentPct: number; baselinePct: number; delta: number }> = [];
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
    ...(runUrl ? [`Actions run: ${runUrl}`] : []),
  ].join(`\n`);

  mkdirSync(path.dirname(markdownOutputPath), { recursive: true });
  writeFileSync(markdownOutputPath, markdown);

  appendGithubOutput(`has_regression=${hasRegression}`);
  appendGithubOutput(`evaluation_error=false`);
  appendGithubOutput(`comment_path=${markdownOutputPath}`);

  if (hasRegression) {
    process.exit(1);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  appendGithubOutput(`has_regression=false`);
  appendGithubOutput(`evaluation_error=true`);
  console.error(`Coverage delta evaluation error: ${message}`);
  process.exit(1);
}
