---
status: proposed
---

# Local Reference authoring Module with CLI-first Adapter

The project proposes a local `Reference Authoring Module` that owns draft
scaffolding, fact/source ledgers, incremental validation, compiler-result
caching, review reports, and atomic publication behind `prepare`, `check`, and
`publish`. Its first Adapter will be a CLI; a later Web Author Console will call
the same Module rather than owning authoring rules.

## Considered options

- Continue editing canonical files and running every full gate manually.
- Build a Web-only CMS whose validation logic lives in UI workflows.
- Let AI generate and directly publish Reference pages from external URLs.
- Build a local deep Module with CLI-first and later Web Adapters.

## Consequences

Authors gain a fast changed-entry loop without weakening the full release gate.
Drafts stay outside canonical content until an atomic checked publish, and tests
can exercise the full behavior through an in-memory Adapter. The project accepts
the cost of versioned draft schemas, impact analysis, and cache invalidation.

AI output remains a draft aid, not a source of truth. Source mappings and
high-risk fact review stay mandatory, and the tool must not scrape, mirror, or
automatically publish external prose.
