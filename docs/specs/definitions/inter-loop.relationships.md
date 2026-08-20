# Inter-loop Relationships

This document defines the intended relationship model between Athena loops.

An inter-loop relationship connects two independent loops for coordination and shared intelligence. It allows one loop to use explicitly authorized knowledge, status, decisions, or coordination services from another loop without merging their task queues, personas, members, connections, routing decisions, or execution state.

The `related` model is a graph, not only a hierarchy. A loop may participate in several `related` associations with different purposes, including coordination, dependency, consultation, and information sharing.

## Loop boundaries

1. A task belongs to exactly one loop at a time.
2. Each loop keeps its own members, routing persona, persona roster, task state, approvals, connections, and execution configuration.
3. A relationship does not grant unrestricted access to either loop. Access to the relationship and access to the information exposed through it must be established independently for the acting user or persona.
4. A relationship does not implicitly copy context, credentials, workgraph items, repositories, providers, runners, or tools between loops.
5. Cross-loop operations must identify both the source loop and destination loop, the requested information or action, and the authorization scope; they must be auditable.

## Related

`related` is the single association between loops. It connects loops that need to exchange context, coordinate work, or signal dependencies while leaving ownership boundaries intact.

A `related` association has exactly two legs. Each leg represents one loop's participation in the association. The legs are independently configured and are not inherently equal or interchangeable.

Each leg must define:

1. **The participating loop** — the loop represented by the leg.
2. **Granted capabilities** — the actions and information exchanges that the participating loop allows the other leg to perform against it.
3. **Scope** — which tasks, decisions, artifacts, statuses, or derived summaries the capabilities apply to.
4. **Constraints** — any limits on how the capabilities may affect work in the other loop.

Capabilities are granted by the administrators of the participating loop. A grant on the LoopA leg defines what LoopB may do against LoopA; it does not define what LoopA may do against LoopB. This allows a `related` association to be asymmetric for any capability or mutual where both loops explicitly grant it.

The available capability vocabulary is implementation-defined, but may include tool access, awareness, context consultation, coordination, dependency signaling, and outcome reporting. The association itself does not imply that any capability is granted.

The `related` association itself does not imply ordering, ownership, inheritance, blocking, or authority to modify the other loop. Those behaviors must be explicitly enabled through grants and constraints and authorized for the relevant operation.

When `related` is used for coordination, it must not create cycles that make progress or completion impossible. Implementations must validate any directional constraints required by the configured capabilities.

## Tool-mediated access

Cross-loop interaction is exposed through Athena tools. A tool call always identifies the target loop and is evaluated against the grant configured on the target loop's leg.

The related-loop tool set includes:

1. **List related loops** — return the loops related to the calling loop and the metadata visible to that leg.
2. **List allowed tools for a related loop** — return the tools that the target loop has granted the calling loop permission to use.
3. **Run an allowed tool against a related loop** — execute one tool granted by the target loop against that specified loop within the tool's authorization and scope.

Tool-mediated access must follow these rules:

1. A tool cannot target a loop unless the two loops have an active `related` association and the target loop has an active grant for the calling loop.
2. A tool cannot be run unless it has been granted by the specified target loop to the calling loop.
3. The target loop remains responsible for evaluating its own access, task state, approvals, and execution policy.
4. Tool results must be limited to the tool's declared output scope. A tool must not expose the target loop's entire context by default.
5. Every call must record the calling leg, target loop, tool, input scope, result status, and timestamp.
6. Tool use does not transfer task ownership or create a direct persona handoff. Any resulting work must be handled through the target loop's normal task and routing rules.

For example, if LoopA creates `related` association `Q` with LoopB:

1. LoopA administrators grant `Q` access to Tools X, Y, and Z on the LoopA leg.
2. LoopB administrators grant `Q` access to Tools X and W on the LoopB leg.
3. A call from LoopA against LoopB may use only Tools X and W.
4. A call from LoopB against LoopA may use only Tools X, Y, and Z.

The effective tool set is therefore determined by the target loop's grant, not by the caller's grant. A tool must also satisfy the caller's normal permissions, the declared scope, and any tool-specific approval requirements.

## Authorization and isolation

1. Creating a `related` association may be requested by an administrator of either loop. The association may remain pending while the other loop reviews it; each leg's grant becomes effective independently.
2. Changing or removing a grant requires permission to administer the relevant loop and access to the `related` association.
3. Reading `related` metadata must not expose task or connection content from the other loop without access to that loop and its grant.
4. Context passed across a relationship must be limited to the explicitly selected task, decision, artifact, status information, or derived summary.
5. Credentials and connection configuration are never transferable through a relationship.
6. Related-association events should include the actor, source loop, destination loop, target-loop grant, action, and timestamp for audit purposes.

## Lifecycle

- Relationships may be created only between existing loops.
- A loop cannot be archived or deleted in a way that silently removes required dependency history.
- Archiving a loop must preserve relationship history and expose affected relationships for review.
- Removing a relationship must not delete the tasks, outcomes, or audit records created while it existed.
- Relationship state and valid transitions remain implementation concerns until the storage and API plan is approved.

## Out of scope

This definition does not establish:

1. A database schema or API shape.
2. Automatic member, persona, or connection inheritance.
3. A shared task queue across loops.
4. Automatic cross-loop execution or approval delegation.
5. A rule that every loop must have a related association.
6. Unrestricted shared memory or automatic retrieval across all related loops.

Implementation must add end-to-end coverage for authorization, isolation, relationship validation, cycle prevention, coordination outcomes, and archive behavior before this roadmap item is marked complete.
