import { test as baseTest } from "@playwright/test";

export * from "@playwright/test";

// Keep a local wrapper so future shared fixtures can be added without changing test imports.
export const test = baseTest.extend({});