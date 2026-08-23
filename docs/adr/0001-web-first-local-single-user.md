---
status: accepted
---

# Web-first local single-user product

The product will be a local Web-first single-user application, with a CLI retained as a first-class Adapter. This favors a complete visual learning experience and local data ownership while avoiding SSR, cloud accounts, multi-user security, and deployment complexity that do not serve the initial Learner.

## Considered Options

- CLI-first product with a later dashboard.
- Local Web-first product.
- Hosted multi-user learning service.

## Consequences

The first vertical slice must include browser editing and judging. The server binds to loopback by default, and multi-user/cloud concerns remain explicitly out of scope.

