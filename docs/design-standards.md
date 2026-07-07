# Design standards

This document defines design defaults for Athena UI work.

## Scope

- Applies to user-facing frontend screens and reusable UI components.
- Preserve existing patterns when extending an established area.

## Minimal defaults

- Keep layouts simple and readable on desktop and mobile.
- Use existing Canonical React Components and Vanilla classes where available.
- Prefer consistent spacing and typography over one-off styling.
- Ensure interactive controls have clear labels and predictable states.
- Keep copy short, task-oriented, and explicit.
- Unless it is genuinely needed, don't use copy at all. 
- Design is done, not when nothing more to be added, but when nothing more to be removed.

## Accessibility baseline

- Use semantic HTML elements for structure and controls.
- Ensure form inputs have associated labels.
- Maintain visible focus states for keyboard navigation.
- Use sufficient color contrast for text and UI affordances.

## Feedback and state

- Show loading, empty, success, and error states for data-driven views.
- Return actionable error text when an operation fails.
- Avoid silent failures.

## Icons and visual assets

- Use only icon tokens that are available in the local icon stylesheet.
- Keep icon usage semantically aligned with navigation/action meaning.
- Avoid introducing new asset sets without team agreement.

## Component Usage Guidelines
- We are using application layout with side navigation. Main & root level items should be on the sidebar.
- Main content should be implemented as full width, Vanilla Framework class to make this happen is `u-no-max-width` on the parent components. 
- Within an area, buttons should be right aligned with primary button most right
- Entity edits & creation should be implemented with a drawer and should be routed with deep links. 
- Entity edit & creation components should be the shared same component. 
- Each component should be encapsulated with a card component.
- Prefer/use VanillaFramework classes instead of custom classes.
- Prefer/use Canonical React Component Library's components instead of css/scss/VanillaFramework classes whenever possible. 
- When there is a list in a component and we place a create button, create button will be right aligned in the same line for the heading of the list. 
- At the top of routed pages we should have breadcrumbs, and headings should only be in the routed components to avoid unnecessary repetitions of headings in parent/child components. 
- Layout only components should avoid padding to preserve whitespace usage.

## Tables & Lists
- In tables action buttons should be on the first column (actions) with action buttons using icons only (unless otherwise necessary).
- In tables' actions column should be best fitting the number of buttons inside, shouldn't be automatically sized.

## Implementation notes

- Keep feature-specific styles near the feature when practical.
- Avoid broad global style overrides for local UI concerns.
- Validate changes with `npm run check` before opening or updating a PR.
