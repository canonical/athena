# Responsibility Rules

1. Local specs are the main source of truth for work to be done and Athena implementation guidance.
2. Objective, Epic, Story, Task, and Subtask are local spec hierarchy levels in this repository and are not tied to any external tracker.
3. An Objective defines a project-level outcome.
4. An Epic defines a stream of work that should be accomplishable within six months.
5. A Story is related to design work.
6. A Task is used to segregate Epic development work.
7. A Subtask is atomic work that can be accomplished by an individual contributor within eight working hours.
8. An Epic is a child of an Objective.
9. A Task is a child of an Epic.
10. A Story is a child of an Epic.
11. A Subtask can be a child of either a Story or a Task.
12. When an Objective is created, the engineering manager persona analyzes the Objective title and content, initiates a discussion with the user, and then hands over the nurturing of the Objective to the product manager personas.
13. Once the engineering manager persona and the user finish the discussion about an Objective, the engineering manager persona updates the Objective content after the user approves the revised content.
14. After the engineering manager persona finishes the Objective discussion and update, the engineering manager persona hands the Objective over to the product manager personas to create Epics.
15. The product manager personas first propose a list of Epics with brief descriptions under the Objective.
16. The product manager personas discuss the proposed Epics with the user and nurture them further before they are finalized.
17. The product manager personas must obtain user approval while creating the Epics.
18. Once the user approves the Epic set and their content, the product manager personas lock the Epics down.
19. Once the Epics are locked down, the product manager personas create Stories for design work and Tasks for development work under the appropriate Epic.
20. The product manager personas refine the Stories and Tasks with the user before they are finalized.
21. The user must approve each Story and each Task after the product manager personas refine them.
22. If an Objective is not defined down to the Story or Task level, no development work can start by the individual contributor personas.
23. The designer persona creates Subtasks for Stories if needed, or starts working directly on Stories when Subtasks are not needed.
24. The individual contributor persona creates Subtasks for Tasks if needed, or starts working directly on Tasks when Subtasks are not needed.
25. Each Story and each Task must be worked on serially rather than in parallel.
26. If Subtasks are created for a Story or a Task, the product manager personas review them and nurture them further if needed before work on those Subtasks starts.
27. The product manager personas define dependencies between spec items while defining those spec items.
28. Each lowest-level spec item must have an estimate expressed in hours.
29. The individual contributor personas are responsible for estimating the lowest-level spec items.
30. The product manager personas define priorities in tandem with the user.
31. Once coding work finishes, the code reviewer persona reviews the code.
32. Once design work finishes, the product manager personas review the design.
33. Once a Task or an Epic is completed, the QA persona performs quality assurance for each completed item.
34. The engineering manager persona is responsible for watching over responsibilities and routing.
35. All Athena specification and reference content must be maintained under `docs/specs`.
36. While developing Athena, agents must retrieve scope, acceptance criteria, dependencies, and status from local specs before and during implementation.