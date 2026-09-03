import { randomUUID } from "node:crypto";
import { createScenarioClient, type ScenarioClient } from "@canonical/test-inference";
import type { ScenarioBuilder } from "./scenario.js";

export type { InferenceOutcome, InferenceScenario } from "@canonical/test-inference";
export { callsTool, fails, replies } from "@canonical/test-inference";

export type InferenceMockOptions = {
  name?: string;
};

const createScope = (name: string): string => {
  if (name.startsWith(`invalid-`)) {
    throw new Error(`Test inference scopes must not start with "invalid-": the service reserves that prefix for credential-failure tests.`);
  }

  return `${name}-${randomUUID()}`;
};

export class InferenceMock {
  readonly scope: string;
  #client: ScenarioClient;
  #active = true;

  constructor(client: ScenarioClient, scope: string) {
    this.#client = client;
    this.scope = scope;
  }

  async mock(source: ScenarioBuilder): Promise<void> {
    if (!this.#active) {
      throw new Error(`Cannot configure test inference scope "${this.scope}" after it has been torn down.`);
    }

    await this.#client.register(this.scope, source.build());
  }

  async teardown(): Promise<void> {
    if (!this.#active) {
      return;
    }

    await this.#client.remove(this.scope);
    this.#active = false;
  }
}

export class TestInferenceService {
  #client: ScenarioClient;
  #tracked = new Set<InferenceMock>();

  constructor(baseUrl: string) {
    this.#client = createScenarioClient(baseUrl);
  }

  async setup(source: ScenarioBuilder, options: InferenceMockOptions = {}): Promise<InferenceMock> {
    const mock = new InferenceMock(this.#client, createScope(options.name ?? `inference`));
    await mock.mock(source);
    this.#tracked.add(mock);

    return mock;
  }

  async teardown(): Promise<void> {
    await Promise.all([...this.#tracked].map((mock) => mock.teardown()));
  }
}

// Both endpoints are the two sides of the `test-inference` port mapping in compose.yaml.
export const testInferenceBaseUrl = `http://127.0.0.1:8099`;
export const testInferenceHealthUrl = `${testInferenceBaseUrl}/health`;
export const inferenceBaseUrl = `http://test-inference:8080/v1`;
export const testInferenceChatModel = `deterministic-chat`;
export const testInferenceEmbeddingModel = `deterministic-embed-1536`;
