# Athena task processing

This document describes the current task processing behavior implemented in Athena runtime code.

For the authoritative task phase and status model, see [task-lifecycle.md](./task-lifecycle.md).

## Scope

- Runtime processor bootstrap: [server.ts](../src/server.ts)
- Processor loop: [task.processor.ts](../src/components/task/task.processor.ts)
- Queue and lifecycle orchestration: [task.controller.ts](../src/components/task/task.controller.ts)
- Queue claiming and persistence: [task.service.ts](../src/components/task/task.service.ts)
- Execution targets: [task.execution.ts](../src/components/task/task.execution.ts)
- Task model, phases, and statuses: [task.schema.ts](../src/components/task/task.schema.ts)

## Processing model

1. Athena starts the task processor from [server.ts](../src/server.ts) when the Express app starts listening.
2. [task.processor.ts](../src/components/task/task.processor.ts) runs two fixed schedules and runs each once at startup.
3. Queue processing runs every `1500ms` with a local overlap guard (`isQueueProcessing`).
4. Pool readiness promotion runs every `60000ms` with a separate overlap guard (`isPoolReadinessProcessing`).
5. Queue schedule calls `taskProcessQueue` in [task.controller.ts](../src/components/task/task.controller.ts).
6. Pool readiness schedule calls `taskPromotePoolReadyTasks` in [task.controller.ts](../src/components/task/task.controller.ts).
7. `taskProcessQueue` drains work one task at a time until no claimable work remains.
8. `taskCreate` message handling is phase-dependent:
   - In `routing/requires-user-input`: appends the user message and writes `status = active`, which the queue picks up to run the routing LLM decision.
   - In `execution/requires-user-input`: appends the user message and writes `status = queued`, which the queue picks up to dispatch execution.

## Single-iteration queue order

Each queue iteration in `taskProcessSingleQueuedTask` uses this exact order:

1. Claim one processable task using `queryNextProcessableTask()`.
2. Claimable tasks satisfy one of:
   - `phase = routing AND status = active`
   - `phase = execution AND status IN (queued, blocked)`
   - `status = processing AND (pingedAt IS NULL OR pingedAt <= NOW() - 120 seconds)` (stale reclaim)
3. Claim order is oldest `updatedAt` first.
4. Claim is persisted atomically by setting:
   - `status = processing`
   - `claimToken = uuidv7()`
   - `claimOwner = <worker-id>`
   - `pingedAt = NOW()`
   - `processingSourceStatus = prior actionable status`
5. After claim, queue processing validates loop readiness before action.
6. If loop readiness is blocked, the claimed task is token-fenced updated to `pool-not-ready`, claim fields are cleared, and processing of that task stops.
7. Action is determined by `(phase, processingSourceStatus)`:
   - `routing / active` → `executeRoutingDecision`
   - `execution / queued` → `dispatchRoutedTask`
   - `execution / blocked` → `reEvaluateBlockedTask`
8. If no eligible task is found, return zeros and stop the drain loop.

## What executing a routing decision does

`executeRoutingDecision` in [task.controller.ts](../src/components/task/task.controller.ts):

1. Resolves active personas and validates one active routing persona.
2. Calls the routing persona LLM once via `resolveRouterDecisionForTask` to select a persona, model, and execution target type together.
3. The routing prompt is history-aware:
   - full transcript for short conversations
   - summary plus recent transcript plus latest user message for longer conversations
   - stable OpenRouter `session_id` per task routing session for cache-friendly provider affinity
4. On success:
   - Resolves a concrete assignment within the chosen target pool via `resolveExecutionTarget`.
   - Updates task to `phase = execution`, `status = queued` with selected persona, model, target type, and target assignment locked.
   - Appends `llm-call` and `routing-decision` timeline entries.
5. On failure (LLM error or validation failure):
   - Updates task back to `phase = routing`, `status = requires-user-input`.
   - Appends `llm-call`, `task-blocked`, and `waiting-user-input` timeline entries.

## What dispatching a queued execution task does

`dispatchRoutedTask` in [task.controller.ts](../src/components/task/task.controller.ts):

1. Validates that the task has a stored `selectedPersona` and `payload.routing.selectedModel` (set during routing decision).
2. Finds the selected persona in active personas; if gone, reverts to `routing/requires-user-input`.
3. Tries sticky assignment reuse first (`resolveStickyExecutionTarget`).
4. If sticky assignment is not usable, resolves a target by loop selection (`resolveExecutionTarget`).
5. Executes target through [task.execution.ts](../src/components/task/task.execution.ts) when a usable target exists.
6. Provider targets run an autonomous loop (provider only) with strict JSON self-evaluation per iteration.
7. Provider execution requests reuse the stored task chat history and send a stable OpenRouter `session_id` per task execution session:
   - `achieved` (boolean)
   - `summary` (string)
   - `output` (string)
   - `nextContext` (optional string)
8. Autonomous loop limits are persisted on each task:
   - `autonomyIterationCount`
   - `autonomyMaxIterations` (default `5`)
9. If `achieved=true`, task transitions to `done/completed`.
10. If max iterations are exhausted without completion, task becomes `execution/requires-user-input`.
11. If no usable target exists, or provider response is invalid/error, task becomes `execution/blocked`.
12. Appends timeline entries: `system-action-started`, `llm-call` per iteration, `system-action-result`, `waiting-user-input`.

## What re-evaluating a blocked task does

`reEvaluateBlockedTask` in [task.controller.ts](../src/components/task/task.controller.ts):

1. Resolves active personas and validates one active routing persona.
2. Calls the routing persona LLM to select a new persona, model, and execution target type via `resolveRouterDecisionForTask`.
3. On success (re-route):
   - Resolves a new execution target.
   - Updates task to `phase = execution`, `status = queued` with new selection locked.
   - Appends `llm-call` and `routing-decision` timeline entries.
4. On failure (LLM error, or routing persona determines user input is needed):
   - Updates task back to `phase = routing`, `status = requires-user-input`.
   - Clears `blocker`.
   - Appends `llm-call`, `routing-decision`, and `waiting-user-input` timeline entries.

## Routing phase chat behavior

When a task is in `routing/requires-user-input` and the user sends a message:

1. `taskCreate(resumeTaskId=...)` is called with the new message.
2. The message is appended as a `chat-session` turn.
3. The task is transitioned to `routing/active` immediately.
4. Queue processing runs the routing decision path.
5. If routing fails, the task returns to `routing/requires-user-input` with timeline evidence.

## Processing lease behavior

While a task is processing, the claimant worker heartbeats every 10 seconds by updating `pingedAt` using `queryTaskPing` in [task.service.ts](../src/components/task/task.service.ts).

Heartbeat updates use a `WHERE` clause that includes `claimToken`, which fences stale workers.

If heartbeat fails token match, the worker stops processing that task immediately.

Final task writes from queue processing are also claim-token fenced by `queryTaskUpdate(expectedClaimToken=...)`.

When a claim-token-fenced final write succeeds, claim fields are cleared.

## Queue claim and scaling behavior

Queue claims in [task.service.ts](../src/components/task/task.service.ts) are scaling-aware:

1. Start transaction.
2. Select candidate IDs using the phase+status claim condition (see above).
3. Order candidates by oldest `updatedAt` first.
4. Use `FOR UPDATE SKIP LOCKED`.
5. Update claimed rows to `processing` with claim lease fields in the same transaction.
6. Commit and return rows preserving claimed ID order.

This prevents multiple Athena instances from claiming the same task row at the same time.

## Flow Chart

```mermaid
flowchart TD
   A[Server starts] --> B[startTaskProcessor]
   B --> C[Queue schedule interval 1500ms]
   B --> C1[Pool readiness schedule interval 60000ms]
   C1 --> C2{isPoolReadinessProcessing}
   C2 -->|yes| Z1[Skip tick]
   C2 -->|no| D1[promote pool-not-ready to execution/queued for ready loops]
   D1 --> U1[Wait next pool-readiness interval]

   C --> C3{isQueueProcessing}
   C3 -->|yes| Z[Skip tick]
   C3 -->|no| D[Set isQueueProcessing true]
   D --> E[taskProcessQueue]

   E --> F[taskProcessSingleQueuedTask]
   F --> G[queryNextProcessableTask]
   G --> H{processable task claimed}

   H -->|no| I[No work this iteration]
   I --> J{both counters zero}
   J -->|yes| K[Stop drain and return counters]
   J -->|no| L[Loop again]

   H -->|yes| M[start 10s heartbeat queryTaskPing with claimToken]
   M --> O{loop readiness blocked}
   O -->|yes| P[token-fenced update to pool-not-ready]
   P --> P1[clear claim fields]
   P1 --> L

   O -->|no| Q{phase + processingSourceStatus}
   Q -->|routing / active| RD[executeRoutingDecision]
   RD --> RD1{routing LLM success}
   RD1 -->|yes| RD2[execution/queued + selected persona/model/runner]
   RD1 -->|no| RD3[routing/requires-user-input + error timeline]
   RD2 --> L
   RD3 --> L

   Q -->|execution / queued| DR[dispatchRoutedTask]
   DR --> S2[resolve sticky or new target]
   S2 --> S3{usable target}
   S3 -->|yes| S4[executeTaskTarget autonomy loop]
   S3 -->|no| S5[execution/blocked no target]
   S4 --> S6[token-fenced final task update\n(completed => phase done)]
   S5 --> S6
   S6 --> L

   Q -->|execution / blocked| RE[reEvaluateBlockedTask]
   RE --> RE1{routing LLM success}
   RE1 -->|yes| RE2[execution/queued + new selection]
   RE1 -->|no| RE3[routing/requires-user-input]
   RE2 --> L
   RE3 --> L

   Q -->|other| L

   M --> T{heartbeat token mismatch}
   T -->|yes| L
   T -->|no| O

   L --> F
   K --> SF[Set isQueueProcessing false]
   Z --> U[Wait next interval]
   SF --> U
```

## Related API trigger

Queue processing can also be triggered via API `POST /api/task/queue/process` in [task.router.ts](../src/components/task/task.router.ts), which calls `taskProcessQueue` directly.
