# Roadmap

| Area                    | Capability                         | Implementation                  | Status | Spec |
| ----------------------- | ---------------------------------- | ------------------------------- | ------ | ---- |
| Authentication          |                                    |                                 | ✅     |      |
| Loop                    |                                    |                                 | 🚧     | [theloop.md][theloop] |
| -                       | Task                               |                                 | 🚧     | [task.md][task] |
| -                       | -                                  | Task Steps                      | 📝     | [task-steps.md][task-steps] |
| -                       | -                                  | User Request Task Source        | 🚧     | [user-request.md][user-request] |
| -                       | -                                  | Tool Execution Task Source      | ⏳     | [task-source.phase2.plan.md][phase2] |
| -                       | -                                  | Webhook Task Source             | 🚧     | [webhook-task.md][webhook-task] |
| -                       | -                                  | Scheduler Task Source           | ⏳     | [task-source.phase4.plan.md][phase4] |
| -                       | -                                  | System Task Source              | ⏳     | [task-source.phase4.plan.md][phase4] |
| -                       | -                                  | Manual Override Task Source     | ⏳     | [task-source.phase4.plan.md][phase4] |
| -                       | Sub-task                           |                                 | ⏳     |      |
| -                       | Deterministic Routing              |                                 | 🚧     | [theloop.md][theloop] |
| -                       | Persona Handoffs                   |                                 | 🚧     | [handoff.definition.md][handoff] |
| -                       | Approval-Gated Actions             |                                 | 🚧     | [tool-usage.md][tool-usage] |
| -                       | Inter-loop Links                   |                                 | ⏳     | [inter-loop.links.md][inter-loop] |
| -                       | Loop Readiness                     |                                 | ✅     |      |
| -                       | Pause and Resume                   |                                 | ⏳     | [llm-harness.md][llm-harness] |
| Persona                 |                                    |                                 | ✅     | [persona.md][persona] |
| -                       | Persona Definition                 |                                 | ✅     | [persona.md][persona] |
| -                       | System Default Persona Definitions |                                 | ✅     | [persona.md][persona] |
| -                       | Persona Loop Assignment            |                                 | ✅     | [persona.md][persona] |
| Connections             |                                    |                                 | 🚧     |      |
| -                       | Connection Types                   |                                 | 🚧     |      |
| -                       | -                                  | WorkGraph                       | 🚧     | [workgraph.md][workgraph] |
| -                       | -                                  | - Jira Backed                   | ✅     | [workgraph-jira-poc.plan.md][workgraph-jira] |
| -                       | -                                  | - Unbacked                      | 🚧     |      |
| -                       | -                                  | - Other PM Systems              | 🚧     |      |
| -                       | -                                  | Repository                      | 🚧     |      |
| -                       | -                                  | - GitHub                        | ✅     |      |
| -                       | -                                  | - Launchpad                     | 🚧     |      |
| -                       | -                                  | - GitLab                        | 🚧     |      |
| -                       | -                                  | - BitBucket                     | 🚧     |      |
| -                       | -                                  | Provider                        | 🚧     | [llm-harness.md][llm-harness] |
| -                       | -                                  | - OpenRouter                    | ✅     | [openai-api-connection.plan.md][openai-plan] |
| -                       | -                                  | - Generic OpenAI API Provider   | 🚧     | [openai-api-connection.plan.md][openai-plan] |
| -                       | -                                  | Runner                          | 🚧     | [runner-harness.md][runner-harness] |
| -                       | -                                  | - GitHub Copilot Cloud          | ✅     | [runner-harness.md][runner-harness] |
| -                       | -                                  | - Athena Workshop Runner        | 🚧     | [workshop-runner.md][workshop-runner] |
| -                       | -                                  | - Juju Athena Machine Charm     | ⏳     | [juju-athena-machine-charm.md][juju-athena-machine-charm] |
| -                       | -                                  | - Other Proprietary Runners     | ⏳     | [runner-harness.md][runner-harness] |
| -                       | -                                  | MCP Connections                 | ⏳     |      |
| -                       | -                                  | - Gatekeeping                   | ⏳     |      |
| -                       | -                                  | - MCP Based Tool Call           | ⏳     |      |
| -                       | -                                  | - MCP Server Token Auto-refresh | ⏳     |      |
| -                       | User-Owned Connections             |                                 | 🚧     |      |
| -                       | -                                  | User-Owned WorkGraphs           | ✅     | [workgraph.md][workgraph] |
| -                       | -                                  | User-Owned Repositories         | ✅     |      |
| -                       | -                                  | User-Owned Providers            | ✅     | [llm-harness.md][llm-harness] |
| -                       | -                                  | User-Owned Runners              | ✅     | [llm-harness.md][llm-harness] |
| -                       | Global Connections                 |                                 | ⏳     |      |
| -                       | -                                  | Global WorkGraphs               | ⏳     |      |
| -                       | -                                  | Global Repositories             | ⏳     |      |
| -                       | -                                  | Global Providers                | ⏳     |      |
| -                       | -                                  | Global Runners                  | ⏳     |      |
| -                       | Connection Loop Assignments        |                                 | 🚧     |      |
| -                       | -                                  | WorkGraph Assignment            | ✅     | [workgraph-jira][workgraph-jira] |
| -                       | -                                  | Repository Assignment           | ✅     |      |
| -                       | -                                  | Provider Assignment             | ✅     | [llm-harness.md][llm-harness] |
| -                       | -                                  | Runner Assignment               | ✅     | [llm-harness.md][llm-harness] |
| -                       | -                                  | MCP Loop Assignment             | ⏳     |      |
| -                       | -                                  | Global Connection Access        | ⏳     |      |
| -                       | -                                  | - Global Connection Catalog     | ⏳     |      |
| -                       | -                                  | - Access Request                | ⏳     |      |
| -                       | -                                  | - Global Admin Approval         | ⏳     |      |
| -                       | -                                  | - Access Revocation             | ⏳     |      |
| -                       | -                                  | - Usage Audit                   | ⏳     |      |
| Memory                  |                                    |                                 | ⏳     | [rag-index.md][rag-index] |
| -                       | Embedding                          | pgvector                        | 🚧     | [rag-index.md][rag-index] |
| -                       | Graph Relationships                | Apache AGE                      | ⏳     |      |
| Tool Calling            |                                    |                                 | ⏳     | [tool-usage.md][tool-usage] |
| -                       | Hard-coded Tool Definitions        |                                 | ✅     | [tool-usage.md][tool-usage] |
| White Labeling          |                                    |                                 | ⏳     |      |
| -                       | Custom Sidebar Logo & Favicon      |                                 | ⏳     |      |

[handoff]: ./specs/definitions/handoff.definition.md
[inter-loop]: ./specs/definitions/inter-loop.links.md
[juju-athena-machine-charm]: ./specs/definitions/juju-athena-machine-charm.md
[llm-harness]: ./specs/definitions/llm-harness.md
[workshop-runner]: ./specs/definitions/workshop-runner.md
[openai-plan]: ./specs/implementation-plans/openai-api-connection.plan.md
[persona]: ./specs/definitions/persona.md
[phase2]: ./specs/implementation-plans/task-source.phase2.plan.md
[phase4]: ./specs/implementation-plans/task-source.phase4.plan.md
[rag-index]: ./specs/definitions/rag-index.md
[runner-harness]: ./specs/definitions/runner-harness.md
[task]: ./specs/definitions/task.md
[task-steps]: ./specs/definitions/task-steps.md
[theloop]: ./specs/definitions/theloop.md
[tool-usage]: ./specs/definitions/tool-usage.md
[user-request]: ./specs/definitions/user-request.md
[webhook-task]: ./specs/definitions/webhook-task.md
[workgraph]: ./workgraph.md
[workgraph-jira]: ./specs/implementation-plans/workgraph-jira-poc.plan.md



- **⏳ Pending** — planned in the specifications but not implemented as a complete feature.
- **📝 Specified** — the scope or behavior is documented in the specifications, but implementation has not started.
- **🚧 WIP** — implementation exists but behavior, contracts, or documentation are still evolving.
- **✅ Done** — an operational implementation exists in the current application.
