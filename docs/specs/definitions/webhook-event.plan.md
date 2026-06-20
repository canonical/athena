# Webhook Event — Implementation Plan

## Overview

This plan covers the implementation of webhook ingestion for Athena loops. Each loop can have multiple webhook configurations. Each inbound webhook payload creates a new event in the loop and follows the standard Athena routing flow described in [theloop.md](./theloop.md).

---

## Data model

### LoopWebhook

One loop can have many webhook configurations.

Each `LoopWebhook` record maps 1:1 to a unique inbound webhook URL (`POST /api/webhooks/:webhookId`).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID v7 | Primary key |
| `loop` | UUID | Foreign key to loop |
| `label` | text | Human-readable name for this webhook config |
| `secret` | text | HMAC signing secret, stored hashed (bcrypt or Argon2) |
| `instructions` | text | Per-webhook instructions appended to EM context for events from this webhook |
| `securityMode` | text | Verification mode selector (for example: `hmac`, `ecdsa`, `rsa_cert`, `jwt_bearer`, `mTLS`, `none`) |
| `securityConfig` | jsonb | Provider-specific header names, algorithms, signed payload recipe, replay window, and key material references |
| `dedupeTtlSeconds` | integer | Retention window for idempotency keys used to ignore duplicate deliveries |
| `active` | boolean | Whether this webhook is currently accepting payloads |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## API surface

### Registration

`POST /api/loops/:loopId/webhooks`

- Authenticated, loop-admin only.
- Generates a random signing secret and returns it **once** in plaintext to the caller. The stored value is a hash; the plaintext is never retrievable again.
- Accepts optional `instructions` to define webhook-specific guidance for the engineering manager persona.
- Requires `securityMode` and `securityConfig`.
- Returns a unique webhook endpoint URL for that webhook configuration.

### List

`GET /api/loops/:loopId/webhooks`

- Authenticated, loop-admin only.
- Returns all webhook configs for the loop. Does **not** return secrets.

### Update

`PATCH /api/loops/:loopId/webhooks/:webhookId`

- Authenticated, loop-admin only.
- Editable fields: `label`, `active`, `instructions`, `securityMode`, `securityConfig`, `dedupeTtlSeconds`.
- Rotating the secret requires deletion and re-creation.

### Delete

`DELETE /api/loops/:loopId/webhooks/:webhookId`

- Authenticated, loop-admin only.
- Immediately stops accepting payloads for this config.

### Inbound payload endpoint

`POST /api/webhooks/:webhookId`

- **Public** endpoint (no session auth required).
- Authenticated via the webhook's configured verification profile (see Security below).

---

## Inbound payload processing

1. Receive `POST /api/webhooks/:webhookId`.
2. Verify the request is not too large (enforce payload size limit, e.g. 512 KB).
3. Look up the webhook config by `webhookId`. If not found or `active = false`, return `404`.
4. Apply verification using `securityMode` + `securityConfig` (see Security below). If verification fails, return `401`.
5. Validate replay window rules (timestamp, nonce, or delivery ID as configured). If stale/replayed, return `400`.
6. Normalise the payload into Athena event context (originating system, event type, payload body).
7. Load per-webhook `instructions` and append them to the event context for the engineering manager persona.
8. Extract configured idempotency key (for example provider delivery ID header). If already processed within `dedupeTtlSeconds`, return `202` and skip event creation.
9. Create a new event in the associated loop with no assigned persona and the normalised payload plus webhook instructions as context.
10. Athena routes the event to the engineering manager persona for assignment.
11. Return `202 Accepted` immediately. All event processing is asynchronous.

---

## Security

### Configurable security profiles

Each webhook configuration selects a verification profile through `securityMode` and `securityConfig`.

Supported modes (MVP):

- `hmac`: HMAC verification over a configurable signed message format.
- `ecdsa`: Public-key ECDSA verification (for providers such as SendGrid signed webhooks).
- `rsa_cert`: RSA signature verification using provider certificate URLs (for providers such as PayPal).
- `jwt_bearer`: Authorization bearer token/JWT validation profile.
- `mTLS`: Optional mutual-TLS client certificate validation at ingress.
- `none`: Disabled verification (allowed only for explicitly trusted internal traffic; discouraged in production).

`securityConfig` must support:

- signature header name(s)
- timestamp header name (optional)
- idempotency/delivery ID header name (optional)
- algorithm (for example `HMAC-SHA256`, `ECDSA-SHA256`, `SHA256withRSA`)
- signed message recipe (for example `raw_body`, `timestamp + raw_body`, `message_id.timestamp.raw_body`)
- replay window seconds
- key material references (secret hash reference, public key reference, cert URL allowlist)
- accepted signature versions/prefixes (for example `sha256=`, `v0=`, `v1,`)

### Provider compatibility matrix

The configurable model must support at least the following well-known providers:

| Provider | Verification model to support |
|---|---|
| GitHub | HMAC-SHA256 using `X-Hub-Signature-256`, raw body, constant-time compare |
| Jira Cloud | HMAC signature in `X-Hub-Signature` (`method=signature`), algorithm from header method, UTF-8 raw body |
| SendGrid | ECDSA signature with `X-Twilio-Email-Event-Webhook-Signature` + `X-Twilio-Email-Event-Webhook-Timestamp`, signed message `timestamp + raw_body` |
| Sentry | HMAC-SHA256 using `Sentry-Hook-Signature`; optional timestamp from `Sentry-Hook-Timestamp` |
| Stripe | `Stripe-Signature` verification, signed timestamp + body with configurable tolerance (default 5 minutes) |
| Slack | HMAC-SHA256 using `X-Slack-Signature`, base string `v0:timestamp:raw_body`, timestamp from `X-Slack-Request-Timestamp` |
| Shopify | HMAC-SHA256 in `X-Shopify-Hmac-SHA256` over raw body (base64 digest), duplicate detection using webhook IDs |
| GitLab | Standard Webhooks signing (`webhook-signature`, `webhook-id`, `webhook-timestamp`), message `id.timestamp.body` |
| PayPal | RSA signature verification via cert URL + transmission headers, or API postback verification fallback |

The inbound verifier should select the configured profile and execute provider-compatible validation without hardcoding provider-specific logic in one path.

### Signature verification

- Every inbound payload must include a signature header (e.g. `X-Athena-Signature: sha256=<hmac>`).
- Athena computes `HMAC-SHA256(secret, raw_request_body)` and compares using a constant-time comparison function to prevent timing attacks.
- If the signature does not match, return `401` and log the failure.

### Replay attack prevention

- Require a timestamp header (e.g. `X-Athena-Timestamp: <unix_epoch_seconds>`).
- Reject payloads where the timestamp is older than 5 minutes or in the future by more than 60 seconds.
- Return `400` for stale or future-dated requests.
- Support profile-specific timestamp windows and replay strategies because providers sign different base strings and use different delivery IDs.

### Secret handling

- Signing secrets are generated with a cryptographically secure random generator (minimum 32 bytes).
- The plaintext secret is returned only once at registration time and never stored in plaintext.
- Secrets are stored as hashes (bcrypt or Argon2).
- Secret rotation is performed by deleting and recreating the webhook config.
- Public keys, certificate URLs, and verification key references are stored in `securityConfig` and validated against allowlists where applicable.

### Payload size limit

- Enforce a maximum payload size before reading the body.
- Reject oversized payloads with `413` before any processing.

### Input validation

- Validate and sanitise the normalised event context before inserting into the database.
- Do not evaluate or execute any content from the payload.
- Validate and sanitise webhook `instructions` on create/update (length limits, UTF-8 text only, reject control characters except newlines).

### Transport security

- Webhook endpoints must only be reachable over HTTPS. Plaintext HTTP requests must be rejected.

### Rate limiting

- Apply rate limiting per `webhookId` to reduce abuse and denial-of-service risk.
- Return `429` when the limit is exceeded.

### Access control

- The inbound payload endpoint (`POST /api/webhooks/:webhookId`) is intentionally public but protected solely by HMAC verification.
- Management endpoints (register, list, update, delete) require an authenticated loop-admin session.

### Idempotency and duplicate handling

- Use provider delivery identifiers when available (for example GitHub delivery ID, Shopify webhook ID/event ID, Jira webhook identifier, GitLab webhook-id, PayPal transmission ID + event ID).
- Store processed IDs with TTL (`dedupeTtlSeconds`) per webhook configuration.
- Duplicate deliveries return `202` without creating new events.

---

## Error handling

| Condition | HTTP response |
|---|---|
| Webhook not found or inactive | `404` |
| Signature invalid | `401` |
| Timestamp stale or invalid | `400` |
| Payload too large | `413` |
| Rate limit exceeded | `429` |
| Payload accepted | `202` |
| Duplicate delivery | `202` |

All validation failures are logged with the `webhookId` and failure reason. Payload content is not logged.

---

## Acceptance criteria

- A loop can have multiple active webhook configurations simultaneously.
- Each webhook config has its own independent secret and can be toggled or deleted without affecting others.
- Each webhook config can define and update per-webhook instructions.
- Per-webhook instructions are included in the context provided to the engineering manager persona for events from that webhook.
- Verification is configurable per webhook and supports the documented schemes for Jira, GitHub, SendGrid, Sentry, Stripe, Slack, Shopify, GitLab, and PayPal.
- Duplicate deliveries are ignored through per-webhook idempotency strategy and do not create duplicate events.
- Payloads with invalid signatures are rejected and never create events.
- Replay attacks using replayed valid payloads older than 5 minutes are rejected.
- Signing secrets are never stored in plaintext and never returned after initial registration.
- Accepted payloads result in a loop event routed to the engineering manager persona.
- The inbound endpoint returns `202` immediately; event processing is asynchronous.
