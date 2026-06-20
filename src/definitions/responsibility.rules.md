# Responsibility Rules

1. Jira tickets are the main source of truth for the work to be done and the source of specifications for Athena implementation.
2. In Jira, an Objective defines a project.
3. In Jira, an Epic defines a stream of work that must be accomplishable within six months.
4. In Jira, a Story is related to design work.
5. In Jira, a Task is used to segregate epic development work.
6. In Jira, a Subtask is atomic work that can be accomplished by an individual contributor within eight working hours.
7. An Epic is a child of an Objective.
8. A Task is a child of an Epic.
9. A Story is a child of an Epic.
10. A Subtask can be a child of either a Story or a Task.
11. When an Objective is created, the engineering manager persona analyzes the Objective title and content, initiates a discussion with the user, and then hands over the nurturing of the Objective to the product manager personas.
12. Once the engineering manager persona and the user finish the discussion about an Objective, the engineering manager persona updates the Objective content after the user approves the revised content.
13. After the engineering manager persona finishes the Objective discussion and update, the engineering manager persona hands the Objective over to the product manager personas to create Epics.
14. The product manager personas first propose a list of Epics with brief descriptions under the Objective.
15. The product manager personas discuss the proposed Epics with the user and nurture them further before they are finalized.
16. The product manager personas must obtain user approval while creating the Epics.
17. Once the user approves the Epic set and their content, the product manager personas lock the Epics down.
18. Once the Epics are locked down, the product manager personas create Stories for design work and Tasks for development work under the appropriate Epic.
19. The product manager personas refine the Stories and Tasks with the user before they are finalized.
20. The user must approve each Story and each Task after the product manager personas refine them.
21. If an Objective is not defined down to the Story or Task level, no development work can start by the individual contributor personas.
22. The designer persona creates Subtasks for Stories if needed, or starts working directly on Stories when Subtasks are not needed.
23. The individual contributor persona creates Subtasks for Tasks if needed, or starts working directly on Tasks when Subtasks are not needed.
24. Each Story and each Task must be worked on serially rather than in parallel.
25. If Subtasks are created for a Story or a Task, the product manager personas review them and nurture them further if needed before work on those Subtasks starts.
26. The product manager personas define dependencies between Jira items while defining those Jira items.
27. Each lowest-level Jira item must have an estimate expressed in hours.
28. The individual contributor personas are responsible for estimating the lowest-level Jira items.
29. The product manager personas define priorities in tandem with the user.
30. Once coding work finishes, the code reviewer persona reviews the code.
31. Once design work finishes, the product manager personas review the design.
32. Once a Task or an Epic is completed, the QA persona performs quality assurance for each completed item.
33. The engineering manager persona is responsible for watching over responsibilities and routing.
34. All Athena work items must roll up under [PRTL-3872](https://warthogs.atlassian.net/browse/PRTL-3872), the Athena AI Orchestrator objective.
35. While developing Athena, agents must use Jira MCP to retrieve ticket scope, acceptance criteria, dependencies, and status before and during implementation.