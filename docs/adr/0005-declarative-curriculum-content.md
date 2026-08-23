---
status: accepted
---

# Declarative curriculum content

Curriculum will use versioned Markdown and JSON manifests validated by JSON Schema, with an allowlist of typed interactive blocks and fixed Judge profiles. Arbitrary MDX execution and arbitrary shell hooks are rejected so that content remains reviewable, migratable, testable, and safe to render or judge.

## Considered Options

- Hand-authored HTML and per-exercise shell scripts.
- Executable MDX with custom JavaScript and shell hooks.
- Declarative content with registered interaction and Judge capabilities.

## Consequences

New interaction or judge behavior requires an explicit platform capability and schema change. Content authors gain less ad-hoc flexibility in exchange for consistent validation and long-term locality.
