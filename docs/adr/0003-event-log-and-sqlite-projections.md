---
status: accepted
---

# Event log with rebuildable SQLite projections

Learning history will be stored as an append-only JSONL event log, while SQLite provides rebuildable read projections for dashboards and queries. This preserves explainable history and migration recovery without forcing all product queries to scan files or making a mutable database the only record of learning.

## Considered Options

- Store only Markdown learning notes.
- Store all state directly in SQLite tables.
- Use an append-only event source plus derived SQLite views.

## Consequences

Every state change needs a versioned event and idempotency. Projection rebuild, upcasting, corruption recovery, and backup verification become mandatory platform capabilities.

