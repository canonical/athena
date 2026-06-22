# Persona Definition

## Persona Entity

A Persona is a loop-scoped execution profile used by Athena routing.

- Personas are persisted in the database per loop.
- Persona records provide the behavior and personality context Athena passes during routing and execution.
- Persona membership and definitions are resolved from loop data at runtime.

## Default Personas

Athena maintains a default persona catalog.

- Default personas are available as baseline seeds for new loops.
- The reference persona files in [../personas](../personas) describe default persona behavior and personality.

## Loop Persona Management

Users can manage personas in a loop with the following constraints:

1. Users can create personas.
2. Users can edit personas.
3. Users can delete personas.
4. The engineering manager (EM) persona cannot be created or deleted by users.
5. The engineering manager (EM) persona can be edited by users.
6. Each loop must always contain exactly one engineering manager (EM) persona.

## Deterministic Routing Inputs

Athena deterministically provides the engineering manager persona with:

- the full persona list for the active loop
- each persona's current personality/definition context

These deterministic inputs are used by the engineering manager persona to select the next assigned persona for each routing decision.
