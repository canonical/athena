# Responsibility Rules

These rules define Athena-wide responsibilities. WorkGraph item hierarchy,
item-type lifecycle, refinement, approval, decomposition, estimation, priority,
review, and QA behavior are configured by the connected WorkGraph and are not
defined by Athena-wide Objective, Epic, Story, Task, or Subtask rules. See
[workgraph.md](../../workgraph.md).

## Documentation and specification ownership

1. Local specs are the source of truth for Athena work and implementation
   guidance.
2. Athena specification and reference content must be maintained under
   `docs/specs`.
3. Before and during implementation, agents must retrieve scope, acceptance
   criteria, dependencies, and status from the applicable local specs.

## Routing and execution ownership

4. The active routing persona is responsible for deterministic routing,
   ownership decisions, and step progression within a loop.
5. Loop administrators select and maintain ordered coding harness and
   OpenAI API-compatible LLM provider profiles for each loop, as defined in
   [llm-harness.md](./llm-harness.md).
6. IC and CR personas execute coding work through the loop's configured coding
   harness priority list under deterministic provider selection.
7. All non-IC and non-CR personas execute through the loop's configured
   OpenAI API-compatible LLM provider priority list under deterministic provider
   selection.
8. Athena evaluates configured provider lists deterministically in priority
   order and uses fallback providers when higher-priority providers are
   unavailable.
9. If all configured providers required for execution are unavailable, Athena
   pauses loop execution, keeps tasks open, and resumes automatically when
   deterministic availability checks succeed.
10. Tool-call approvals are handled per tool call through the standard Chat UI
    approval mechanism; approval authority is the user.

## Runtime reliability

11. Athena runtime implementation must support horizontal scaling across
    multiple instances without changing deterministic orchestration outcomes.
12. Distributed task execution must enforce a single effective active claim per
    task and prevent duplicate side effects through idempotency controls.
13. Deterministic orchestration logic must remain correct under concurrent
    processing and retries across instances.
14. Concurrency-control and deduplication mechanisms used for horizontal
    scaling must be observable and auditable.
