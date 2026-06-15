# Athena testing standards

This document is the source of truth for test strategy and test scope.

## Test strategy

1. Athena uses Playwright end-to-end testing only.
2. We do not introduce unit tests or integration-only test suites unless explicitly requested.
3. E2E tests are the primary verification mechanism for backend and frontend behavior.
4. E2E specs must not use mocks, fixtures, or test doubles; they should exercise the real application stack end to end.

## Scope requirements

1. Tests must validate backend and frontend functionality through public interfaces (HTTP endpoints and end-to-end flows).
2. New backend and frontend behavior should ship with E2E coverage in co-located `*.spec.ts` tests.
3. E2E scenarios should exercise happy paths, key validation failures, and error handling paths for changed backend and frontend behavior.

## Coverage requirements

1. E2E test runs must generate coverage reports.
2. Coverage outputs must be published in CI artifacts and made available for review in pull requests.
3. A change is not complete if backend or frontend behavior was added or changed without corresponding E2E coverage updates.

## Coverage collection contract

1. Coverage collection must include both frontend and backend runtime coverage from E2E execution.
2. Frontend coverage source is Istanbul payload captured from browser context for each E2E scenario.
3. Backend coverage source is Istanbul/NYC runtime payload captured from the Athena service process after E2E execution.
4. Coverage path remapping from container/runtime paths to workspace paths is mandatory before merging and report generation.
5. Coverage collection scripts must be deterministic and safe to run in CI and local containerized environments.

## Coverage output contract

1. Raw coverage outputs must be written to dedicated intermediate directories:
   - `testing/results/.nyc_frontend`
   - `testing/results/.nyc_backend`
   - `testing/results/.nyc_merged`
2. Final coverage reports must be generated under `testing/results/coverage`.
3. Coverage report formats must include:
   - HTML report (`index.html`)
   - LCOV report (`lcov.info`)
   - Cobertura XML report (`cobertura-coverage.xml`)
   - Text summary in test logs
4. Report generation must fail the test job when merged coverage data cannot be processed.

## CI publication contract

1. Pull request CI must publish the full coverage report directory as a build artifact.
2. Pull request CI must post a pull request comment summarizing coverage deltas/highlights and linking to the uploaded coverage artifact.
3. Pull request coverage artifacts must use `retention-days: 7`.
4. CI output must clearly indicate where coverage artifacts are available.
5. A failing coverage generation step must fail the CI test job.
6. A failing artifact upload step must fail the CI test job.
7. Pull request CI must fail when current coverage is below the committed repository baseline.

## Baseline recording contract

1. A post-merge workflow on `main` must run the coverage-enabled test command and refresh the committed coverage baseline file.
2. The baseline file must live in the repository and be used by pull request CI to enforce non-regression.
3. Baseline refresh commits must be automated and loop-safe.

## Execution modes

1. Local functional run: use the standard Playwright command for fast E2E feedback.
2. Coverage run: use a dedicated coverage-enabled E2E command that captures, normalizes, merges, and reports frontend plus backend coverage.
3. CI coverage run must use the dedicated coverage-enabled command.

## Execution baseline

- Playwright configuration source: `playwright.config.ts`
- Standard test command: `npm test`
- Tests live co-located under `src` as `*.spec.ts` files.
