# Webhook Event

## Definition

A webhook event is an event triggered by an inbound webhook payload from an external system configured for a loop. Webhook ingestion is optional and must be configured per loop.

Implementation details for this source are defined in [implementation-plans/index.md](../implementation-plans/index.md).

## Characteristics

- Webhook ingestion must be explicitly configured for the loop. It is not active by default.
- Each webhook configuration has a unique endpoint URL.
- When a webhook payload is received, Athena creates an event in the loop with the payload as context and no assigned persona.
- Athena then routes the event to the active routing persona for assignment, following the standard loop flow in [theloop.md](./theloop.md).

## Supported Sources

Any system capable of sending an HTTP webhook can be a source. Common examples:

- Jira (issue created, status changed, comment added)
- GitHub (pull request opened, review requested, check completed)
- Other third-party tools configured by the user

## Content

The webhook payload is normalized into event context by Athena before being passed to the active routing persona. The context includes:

- The originating system and event type.
- The payload body, normalized to the event context format defined in [event.md](./event.md).
- Any loop-specific mapping rules configured by the user.
- Per-webhook instructions configured on the webhook record and appended to the active routing persona context.

## Webhook Ingestion Pipeline Diagram

```mermaid
flowchart TD
	A[POST /api/webhooks/:webhookId] --> B{Payload size within limit?}
	B -->|No| R413[Return 413]
	B -->|Yes| C{Webhook exists and is active?}
	C -->|No| R404[Return 404]
	C -->|Yes| D{Verification passes for configured security mode?}
	D -->|No| R401[Return 401]
	D -->|Yes| E{Replay window valid?}
	E -->|No| R400[Return 400]
	E -->|Yes| F[Normalize payload into event context]
	F --> G[Append per-webhook instructions]
	G --> H{Duplicate delivery in dedupe window?}
	H -->|Yes| R202A[Return 202, no new event]
	H -->|No| I[Create unassigned loop event]
	I --> J[Route event to routing persona isRouting true]
	J --> R202B[Return 202 Accepted]
```
