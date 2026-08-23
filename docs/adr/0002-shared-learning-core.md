---
status: accepted
---

# Shared learning core with multiple Adapters

Web, CLI, tests, and future MCP will call one `LearningPlatform` Interface rather than implementing teaching rules independently. This creates one deep Module for Activity lifecycle, Evidence, Concept state, hint independence, and Review scheduling, preventing semantic drift between presentation paths.

## Considered Options

- Put orchestration in HTTP routes and reproduce it in CLI commands.
- Share utility functions while allowing each Adapter to own workflows.
- Centralize workflows behind one command/query/event Interface.

## Consequences

Presentation Adapters stay thin and require contract tests. The Learning Platform becomes the primary behavior test surface and composition requires explicit Module dependencies.

