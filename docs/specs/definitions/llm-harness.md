# LLM and Harness Definition

## Purpose

This definition specifies how Athena selects and governs coding harnesses and LLM runtimes per loop.

The goals are:

- deterministic orchestration behavior
- explicit loop-admin control of execution providers
- forward-compatible support for additional harnesses and model providers

## Role-specific execution mode

Execution mode is selected by persona responsibility.

- IC and CR personas must execute coding work through a configured coding harness integration.
- Other personas execute through a direct LLM runtime using an OpenAI API-compatible interface.

Athena routing authority remains unchanged. Provider selection does not change ownership, handoff, or approval semantics.

## Loop-admin configuration authority

Loop administrators configure provider settings for their loop.

- Loop administrators configure an ordered coding harness profile list for IC and CR persona execution.
- Loop administrators configure an ordered OpenAI API-compatible LLM provider profile list for all non-IC and non-CR persona execution.
- Order is priority-based (`1..N`) and is evaluated deterministically from highest to lowest priority.
- Loop administrators can update these profiles over time.
- Provider profile updates must be auditable with actor, timestamp, prior value, and new value.

## Coding harness catalog

Athena should maintain a registered harness catalog with per-entry lifecycle state.

MVP catalog policy:

- The loop admin must explicitly configure a harness profile priority list.
- The only harness that is allowed for execution in MVP is GitHub Copilot Cloud Agent.
- If a different harness is configured in MVP, Athena must reject activation and return a clear unsupported-in-MVP validation error.

Validated harness candidates for current and future use:

1. GitHub Copilot Cloud Agent
   - Status: MVP execution harness (required allowed option).
2. OpenAI Codex agent surfaces (Codex app and related Codex agent workflows)
   - Status: candidate harness for post-MVP enablement.
3. Claude Code agent surfaces
   - Status: candidate harness for post-MVP enablement.
   - Validation note: public Claude Code documentation confirms terminal, IDE, desktop, and web agent surfaces; naming is "Claude Code" rather than a distinct product named "Claude Code Cloud Agent".
4. Devin (Cognition) cloud agent
   - Status: candidate harness for post-MVP enablement.
5. Juju machine charm based harness
   - Status: MVP+1 Athena-owned implementation target.

Additional harnesses may be added to the catalog after capability and security validation.

## Non-coding persona LLM runtime policy

All personas except IC and CR must use an OpenAI API-compatible interface configured per loop.

- Each configured profile must define provider endpoint, model identifier, and credential reference.
- The loop configuration must include a deterministic provider priority order.
- Athena definitions remain canonical for behavior and policy regardless of selected provider.
- Provider choice must not alter deterministic routing, ownership rules, or approval authority.

## Conversation schema validation (Zod)

Athena must auto-validate LLM and harness conversation payloads against Zod schemas before any side-effecting execution step.

- Validation must run before tool invocation, event-status mutation, handoff emission, or persistence of structured conversation outputs.
- Validation schemas are part of deterministic Athena contracts and must be versioned.
- The validation result must be auditable (schema version, pass or fail, failure summary, timestamp).
- Raw provider responses may be retained for diagnostics under governance controls, but only validated payloads can drive orchestration decisions.

When validation fails:

- Athena must treat the response as invalid output, not as a successful execution.
- Athena may retry according to deterministic retry policy.
- If retries are exhausted, Athena must keep the event open and route via existing blocked-handoff protocol in [handoff.definition.md](./handoff.definition.md).

## Deterministic failover model

- For each execution request, Athena attempts the highest-priority configured provider first.
- If that provider is unavailable, Athena attempts the next configured provider in order until one succeeds or the list is exhausted.
- Failover traversal order must be deterministic and auditable.
- Successful execution through a fallback provider does not change loop ownership or event semantics.

## Provider unavailability handling

- Provider unavailability is an infrastructure availability condition, not an event completion outcome.
- Events must not be auto-completed or auto-blocked solely because configured providers are unavailable.
- If all providers in the relevant priority list are unavailable, Athena pauses loop execution and records the pause reason as provider unavailable.
- While paused for provider unavailability, Athena must keep loop events open and stop dispatching new event execution attempts for that loop.
- Athena must run deterministic availability checks on a configured fixed frequency and resume the loop automatically when an eligible provider becomes available.
- Pause and resume transitions must be auditable with reason, timestamp, and selected provider at resume time.

## Determinism and fallback constraints

- Harness and LLM provider integrations are execution infrastructure and must not redefine Athena policy.
- If a configured provider is unavailable, Athena should fail clearly and preserve auditable failure context.
- Where fallback is configured, fallback activation must be explicit, traceable, and policy-compliant for the loop.

## Cross references

- Tool execution semantics and records: [tool-usage.md](./tool-usage.md)
- Routing and ownership protocol: [interaction.protocol.md](./interaction.protocol.md)
- Loop ownership and membership model: [theloop.md](./theloop.md)