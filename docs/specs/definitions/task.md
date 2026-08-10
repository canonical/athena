# Task Definition

## Purpose

Task is a lightweight UI/domain record in the current Athena branch.

## Canonical schema

The task schema is defined in [task.schema.ts](../../../src/components/task/task.schema.ts) and contains only:

1. `id` (UUID v7)
2. `title` (optional normalized string)

## Notes

- There is no task lifecycle state machine in this branch.
- There is no task routing, queue processor, or autonomous task execution runtime in this branch.
- Task APIs currently support list-focused behavior only.
