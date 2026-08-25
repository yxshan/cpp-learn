---
status: accepted
---

# Separate declarative C++ API Reference Module

The platform will model C++ Reference Entries in a separate read-only deep
Module backed by versioned JSON manifests, Markdown, and original example
files. Curriculum Activities own links to stable Entry IDs, while the
composition root validates the cross-catalog index; Reference
Entries do not inherit Activity prerequisites, Workspaces, Judges, reflections,
or Evidence policies.

## Considered Options

- Model every Reference Entry as a Curriculum Activity.
- Bundle unvalidated Markdown directly in the Web Adapter.
- Mirror or scrape an external Reference site.
- Add a separate declarative Reference Module with validated local content.

## Consequences

The new Module adds a schema, content gate, query contracts, and Web route, but
keeps reference browsing out of learning-state orchestration. Content remains
offline, reviewable, and testable through one small Interface. Search and
navigation logic gain locality instead of spreading across React callers.

The project must author or explicitly attribute content and cannot treat
external Reference prose as implementation data. Interactive examples require
a later temporary Playground contract; they cannot reuse an Activity identity
or produce Evidence.
