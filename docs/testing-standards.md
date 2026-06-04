# Athena testing standards

This document is the source of truth for test strategy and test scope.

## Test strategy

1. Athena uses Playwright end-to-end testing only.
2. We do not introduce unit tests or integration-only test suites unless explicitly requested.
3. E2E tests are the primary verification mechanism for backend and frontend behavior.

## Scope requirements

1. Tests must validate backend and frontend functionality through public interfaces (HTTP endpoints and end-to-end flows).
2. New backend and frontend behavior should ship with E2E coverage in co-located `*.spec.ts` tests.
3. E2E scenarios should exercise happy paths, key validation failures, and error handling paths for changed backend and frontend behavior.

## Coverage requirements

1. E2E test runs must generate coverage reports.
2. Coverage outputs must be published in CI artifacts and made available for review in pull requests.
3. A change is not complete if backend or frontend behavior was added or changed without corresponding E2E coverage updates.

## Execution baseline

- Playwright configuration source: `app/playwright.config.ts`
- Standard test command: `cd app && npm run test`
- Tests live co-located under `app/src` as `*.spec.ts` files.
