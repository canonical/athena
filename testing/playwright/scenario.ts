import { fails, type InferenceExchange, type InferenceMatcher, type InferenceOutcome, type InferenceScenario, replies } from "@canonical/test-inference";

const modelValidationProbe = `.`;
type BuiltExchange = InferenceExchange & { when: InferenceMatcher };

const describeMatcher = (when: InferenceMatcher): string => JSON.stringify(when);

export class ScenarioBuilder {
  #fromTheStart: BuiltExchange[] = [];
  #laterTurns: BuiltExchange[] = [];
  #fallback: InferenceOutcome | null = null;

  #add(bucket: BuiltExchange[], when: InferenceMatcher, outcome: InferenceOutcome, atFront: boolean): this {
    const duplicate = [...this.#fromTheStart, ...this.#laterTurns].find((exchange) => describeMatcher(exchange.when) === describeMatcher(when));

    if (duplicate) {
      throw new Error(`This scenario already declares an exchange matching ${describeMatcher(when)}.`);
    }

    if (atFront) {
      bucket.unshift({ when, outcome });
    } else {
      bucket.push({ when, outcome });
    }

    return this;
  }

  answersModelValidation(outcome: InferenceOutcome = replies(`ok`)): this {
    return this.#add(this.#fromTheStart, { userMessageEquals: modelValidationProbe }, outcome, false);
  }

  failsModelValidation(message: string): this {
    return this.#add(this.#fromTheStart, { userMessageEquals: modelValidationProbe }, fails(message), false);
  }

  whenToolOffered(name: string, outcome: InferenceOutcome): this {
    return this.#add(this.#fromTheStart, { toolOffered: name }, outcome, false);
  }

  whenConversationMentions(text: string, outcome: InferenceOutcome): this {
    return this.#add(this.#fromTheStart, { messagesContain: text }, outcome, false);
  }

  // Later-turn matchers come first because conversation history grows and matching is first-win.
  onceHistoryShows(marker: string, outcome: InferenceOutcome): this {
    return this.#add(this.#laterTurns, { messagesContain: marker }, outcome, true);
  }

  otherwise(outcome: InferenceOutcome): this {
    if (this.#fallback) {
      throw new Error(`This scenario already declares a fallback outcome.`);
    }

    this.#fallback = outcome;
    return this;
  }

  build(): InferenceScenario {
    const exchanges = [...this.#laterTurns, ...this.#fromTheStart];

    if (exchanges.length === 0 && !this.#fallback) {
      throw new Error(`This scenario has no exchanges or fallback outcome.`);
    }

    return this.#fallback ? { exchanges, default: this.#fallback } : { exchanges };
  }
}

export const scenario = (): ScenarioBuilder => new ScenarioBuilder();

export const modelValidationScenario = (): ScenarioBuilder => scenario().answersModelValidation();
