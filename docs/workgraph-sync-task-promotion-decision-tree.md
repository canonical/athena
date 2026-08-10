# Workgraph Sync Task Promotion Decision Tree

This diagram reflects the current implementation after the latest fixes in:

- `src/components/workgraph/workgraph.sync.service.ts`
- `src/components/task/task.controller.ts`
- `src/components/task/task.service.ts`

```mermaid
flowchart TD
  A[Start synchronizeLoopWorkgraphAndPromoteTasks] --> B{Sync connection exists?}
  B -- No --> B1[Throw WorkgraphNotFoundError]
  B -- Yes --> C{Assignment enabled?}
  C -- No --> C1[Throw WorkgraphValidationError]
  C -- Yes --> D{Switch on workgraph type}
  D -- jira --> E{JQL configured?}
  D -- default (unsupported type) --> D1[Throw WorkgraphValidationError]
  E -- No --> E1[Throw WorkgraphValidationError]
  E -- Yes --> F[Read existing loopWorkgraph items]
  F --> G[Build pre-sync existing itemKey set]
  G --> H[Fetch synced Jira items]
  H --> I[Upsert loopWorkgraph items via replace]
  I --> J[Load current loopWorkgraph items]
  J --> K[For each workgraph item]

  K --> L{Has Work On label?}
  L -- No --> K
  L -- Yes --> M{Has WIP label OR Done label?}
  M -- Yes --> K
  M -- No --> N[Determine title suffix by pre-sync existence]
  N --> N1{itemKey existed before sync?}
  N1 -- No --> N2[title = <item title> Created]
  N1 -- Yes --> N3[title = <item title> Updated]

  N2 --> O[taskCreate source=workgraphItem]
  N3 --> O

  O --> P[queryTaskCreateForWorkgraphItem]
  P --> Q[Acquire advisory transaction lock by workgraphItem id hash]
  Q --> R{Exists active task for same loop+workgraphItem?
status != completed}
  R -- Yes --> S[Return null, skip creation]
  R -- No --> T[Insert queued task]

  T --> U[Trigger task processor]
  U --> V[Increment createdTaskCount]
  S --> K
  V --> K

  K --> W[Return syncedCount and createdTaskCount]
```
