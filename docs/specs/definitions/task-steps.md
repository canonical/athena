# Task Steps Definition

## Purpose

Task steps are ordered child units that define the work a task must pass through
within a loop. A task step sequence is selected when a task is created and is
then snapshotted onto the task so later loop-configuration changes do not alter
in-flight work.

## Loop-level step sequences

1. A loop admin may define multiple named step sequences for a loop.
2. Each sequence has a stable name/key and an ordered list of step definitions.
3. Each task source may be mapped to one step sequence. The loop's default
   sequence is used when no more specific mapping exists.
4. Task-source mappings may be expanded in the future as new task sources are
   introduced.
5. A sequence may be renamed or deleted even when existing tasks reference it;
   existing task snapshots remain unchanged.
6. Editing a sequence or its source mapping affects only tasks created after the
   edit.

## Step definition

Each step definition contains:

- a UUID v7 identifier;
- a stable name;
- its sequence order;
- step-specific instructions/prompts for the LLM;
- a persona selection policy and, when pre-selected, the persona;
- a model selection policy and, when pre-selected, the model.

The persona and model may each be either pre-selected by the loop admin or
selected by the routing persona. Any routing-persona selections are persisted in
the task snapshot before the corresponding step executes.

A step definition may occur more than once when the routing persona revisits
that step. Each occurrence is a distinct execution instance of the same step
definition and owns a separate history. The task stores occurrences in an
append-only `stepExecutions` array; adding an occurrence never mutates earlier
entries. Each occurrence references the UUID v7 of its step definition.

## Step Sequence Snapshot

At task creation/start, Athena copies the selected step sequence into the task.
The snapshot includes the sequence identity and name, every step definition,
its order, step-specific instructions/prompts, and the resolved persona/model
selections. Subsequent edits to the
loop step sequence definitions do not affect existing tasks.

The first step in the snapshot is the initial step target. Before that step
executes, Athena deterministically identifies that routing action is required
and invokes the routing persona to select or confirm the first step.

Tasks created before task steps are introduced are migrated to one step named
`Default`. The migrated step preserves the task's current persona and model.
Its identifier is a valid UUID v7 with non-required fields zero-filled as far as
the UUID v7 format allows.

## Execution

1. Steps execute strictly one at a time in sequence order.
2. A task cannot skip a step, branch, or execute steps in parallel.
3. Athena's deterministic code identifies routing points before the first step,
   between steps, and after the final step, then invokes the routing persona for
   the required action.
4. Each step occurrence has its own history. LLM and user interactions for the
   occurrence are recorded only in that occurrence's history.
5. The assigned step LLM ends its occurrence by calling the step-completion
   tool and providing a summary.
6. Athena appends the summary to the task's full summary history with a
   reference to the completed step's UUID v7.
7. At the end of each step, Athena asks the routing persona to evaluate whether
   execution should proceed to the next step or go back to an earlier step.
   When going back, the routing persona selects the earlier step.
8. While requesting a routing decision, Athena provides the routing persona with
   the complete step sequence snapshot and the full task-level summary history.
9. Athena creates the selected step occurrence's system message and first user
   message from the selected step's instructions/prompts and the full task-level
   summary history before that occurrence's LLM work begins.
10. A revisit creates a new occurrence with a new separate history. Each visit
   and its associated routing decision are retained in that occurrence history.
11. After the final step occurrence, Athena invokes the routing persona for the
    post-sequence action. The routing persona may provide final direction, after
    which `complete_task` may be proposed.
12. A task is completed only after its final step occurrence is completed and
    the approval-gated `complete_task` call succeeds.
13. Steps and tasks do not have a blocked status. If progress needs human input,
   the task remains in its independently stored status while the relevant
   occurrence history awaits a user response.

## Statuses

Tasks use these independently stored statuses:

- `queued`
- `wip`
- `completed`

Each step execution occurrence supports these statuses:

- `active`
- `completed`

Task history contains task-level events and step summaries. Every step summary
stores the step definition's UUID v7. Step-specific LLM and user messages belong
to the occurrence history, not directly to the task history.

Each `stepExecutions` entry stores its occurrence status, selected persona and
model, and its separate occurrence history. When a step is revisited, previous
execution entries remain unchanged and the new execution starts independently.

An occurrence status is either `active` or `completed`.

## Progression tools

The task-step tool catalog includes:

- `complete_step`: approval-gated tool available to the assigned step LLM. It
  accepts the occurrence summary and signals that the current step occurrence
  is complete.
- `complete_task`: approval-gated tool available only after the final step. It
  signals task completion and changes the independently stored task status to
  `completed`.

Approval is required before either tool can produce its state transition. The
user grants or rejects approval from the Chat UI using the standard tool-call
approval mechanism. After either decision, the user may add a Chat UI message.
If `complete_step` is rejected, the routing persona decides what to do next,
using the complete task-level summary history and any user message as context.

The task-level summary history is the complete ordered collection of summaries
from all step occurrences. Both the routing persona and every subsequent step
receive this complete summary history as context. Occurrence histories preserve
the detailed interaction for each visit, including associated routing decisions.
Routing decisions before the first step and after the final step are retained as
task-level events. The task UI displays the complete task history and indicates
the task's active step.

## User interface

The task UI displays the task's current step and status within the existing task
view. Step occurrence histories remain within that task view and are presented
as part of the task's step context; they do not become standalone tasks.
