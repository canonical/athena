# Security Policy

## Reporting a vulnerability

If you discover a security issue in Athena, do not open a public issue.

Report it to Canonical Security (PSIRT):

- Email: [security@ubuntu.com](mailto:security@ubuntu.com)
- Policy: [Ubuntu Security disclosure and embargo policy](https://ubuntu.com/security/disclosure-policy)

Please include as much detail as possible:

- Affected component and version/commit.
- Reproduction steps or proof of concept.
- Expected behavior and observed behavior.
- Impact and potential exploitability.
- Any workaround or suggested fix.

## What is in scope

Security reports are in scope for code and configuration in this repository, including:

- Backend/API code under [src](./src).
- Frontend code served by Athena under [src](./src).
- Authentication/session handling and secret handling.
- Database schema and migrations under [migrations](./migrations).
- Packaging and deployment artifacts under [charm](./charm), [rockcraft.yaml](./rockcraft.yaml), and [compose.yaml](./compose.yaml).

## Response process

Canonical PSIRT coordinates triage, embargo handling, remediation guidance, and disclosure.
Repository maintainers are engaged during triage and fix validation.

Athena is currently an early-stage project. Security fixes are handled on a best-effort basis and prioritized by impact.