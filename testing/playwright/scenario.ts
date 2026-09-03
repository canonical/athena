import { fails, type InferenceOutcome, type InferenceScenario, replies } from "@canonical/test-inference";

// Athena validates a model by sending a single "." user message.
const modelValidationProbe = `.`;

type OutcomeChain = readonly [InferenceOutcome, ...InferenceOutcome[]];

export class ScenarioBuilder {
  #chains = new Map<string, OutcomeChain>();

  #set(prompt: string, chain: OutcomeChain): this {
    if (this.#chains.has(prompt)) {
      throw new Error(`This scenario already answers the prompt ${JSON.stringify(prompt)}.`);
    }

    this.#chains.set(prompt, chain);
    return this;
  }

  answersModelValidation(outcome: InferenceOutcome = replies(`ok`)): this {
    return this.#set(modelValidationProbe, [outcome]);
  }

  failsModelValidation(message: string): this {
    return this.#set(modelValidationProbe, [fails(message)]);
  }

  // The prompt must equal a user message verbatim; each further outcome answers one more turn of the same conversation.
  answers(prompt: string, ...outcomes: OutcomeChain): this {
    return this.#set(prompt, outcomes);
  }

  build(): InferenceScenario {
    if (this.#chains.size === 0) {
      throw new Error(`This scenario answers no prompts.`);
    }

    return Object.fromEntries(this.#chains);
  }
}

export const scenario = (): ScenarioBuilder => new ScenarioBuilder();

export const modelValidationScenario = (): ScenarioBuilder => scenario().answersModelValidation();
