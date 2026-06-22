# Tool Usage Definition

## Purpose

This definition specifies how personas use tools during event execution in Athena loops.

Harness and LLM provider selection rules are defined in [llm-harness.md](./llm-harness.md).

Tools extend persona capability. Tools do not change Athena routing authority.

- Athena remains deterministic orchestration code.
- Athena routes unassigned events to the engineering manager persona.
- Only the engineering manager persona can push an event with an assigned persona.
- Tool outputs are context inputs for personas; they are not ownership decisions.

## Tool usage model

Tool usage is always attached to an active event.

- A persona may invoke zero or more tools while processing an event.
- Tool usage must be traceable in event context (tool name, intent, execution state, result summary, timestamp).
- Tool invocations can fail. Failures are recorded in event context and handled by the active persona.
- Tool usage must not leak secrets into user-visible responses.

## Tool execution record (minimum)

Each tool invocation appended to event context must include at least:

- `toolName`
- `intent`
- `executionState` (`requested`, `running`, `succeeded`, `failed`)
- `startedAt`
- `finishedAt` (required when terminal state is reached)
- `resultSummary` (required when `executionState` is `succeeded`)
- `failureSummary` (required when `executionState` is `failed`)

Athena orchestration can persist additional provider-specific metadata, but the minimum record fields above are required for deterministic replay and audit.

## Research tool (MVP priority)

Research is the first-class tool for evidence gathering from trusted sources.

### Goal

Collect factual context that improves engineering manager and assigned persona decisions.

### Inputs

- Research question
- Scope constraints (product area, loop context, time window, source constraints)
- Required output structure (facts, open questions, risks, recommended next actions)

### Outputs

- Findings summary
- Source references
- Confidence notes and known gaps
- Suggested follow-up actions

### Constraints

- Research must distinguish facts from assumptions.
- Conflicting sources must be explicitly noted.
- Sources must be attributable (URL or internal document reference).
- Research does not assign the next owning persona.

### Event integration

Research output is appended to event context and consumed by the current owner.
If routing is needed after research, Athena routes through the engineering manager persona per [theloop.md](./theloop.md).

## Initial tool catalog to populate

The following tool categories are included for MVP planning beyond Research.

1. Summarize
   - Condense long artifacts into structured context for event processing.
2. Validate
   - Check schema, policy, or rule compliance against definition files, including Zod-based conversation payload validation defined in [llm-harness.md](./llm-harness.md).
3. Transform
   - Convert source artifacts into normalized Athena event context.
4. Retrieve
   - Fetch loop-linked artifacts (docs, specs, payload history) for current event context.
5. Compare
   - Diff two artifacts and return behavior-impact oriented change notes.

## Governance

- Tool definitions must be deterministic at the orchestration level (clear inputs, outputs, and failure behavior).
- Tool contracts are defined by Athena implementation and corresponding definitions; runtime execution must follow those deterministic contracts.
- Tool availability can be configured per loop by allowing or disallowing tools from the registered tool library.
- Allow or disallow configuration changes which tools are callable, but does not redefine tool contracts or routing authority.
- Tool usage policies belong in definitions, not in persona reference files.
- Persona files in [../personas/index.md](../personas/index.md) remain role references; they do not define orchestration or routing policy.

## Optimization runtime policy

Athena may execute tools through an optimization runtime (for example [rtk-ai/rtk](https://github.com/rtk-ai/rtk)) or an equivalent implementation.

- Optimization runtime choice must not change ownership or routing semantics defined in [theloop.md](./theloop.md) and [interaction.protocol.md](./interaction.protocol.md).
- Tool contracts remain canonical in Athena definitions; optimization runtimes are execution infrastructure, not policy authority.
- Any optimization feature (caching, batching, deduplication, speculative execution, retry shaping, or model selection) must preserve equivalent user-visible outcomes for the same event context.
- If optimization introduces non-deterministic variance, Athena must persist enough execution metadata to make outcomes explainable and auditable.
- Optimization configuration should be pluggable and provider-agnostic so Athena can switch between RTK and compatible runtimes without redefining tool behavior.
- Optimization failures must degrade gracefully to baseline tool execution when possible, while still recording failure details in the event context.

### Additional execution metadata (recommended)

When an optimization runtime is used, each tool execution record should also include:

- `runtimeName` (for example `rtk`)
- `runtimeVersion`
- `optimizationProfile` (for example `default`, `latency-optimized`, `cost-optimized`)
- `optimizationDecisions` (summary of cache hit, batching, deduplication, fallback, or retry strategy)

## Failure handling

- A failed tool execution does not change event ownership by itself.
- Attempting a disallowed tool must be recorded as a failed execution with a policy-denied failure summary.
- The active persona decides whether to retry the tool, continue with partial evidence, or perform a blocked handoff per [handoff.definition.md](./handoff.definition.md).
- Retries must be recorded as separate tool execution records.

## Event source mapping

Tool-triggered work should be represented as a tool execution event source as defined in [event.md](./event.md).
