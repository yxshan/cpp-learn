# Stage 6.1 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-009 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Scope delivered

- Added a deterministic token-aware C++ formatter for source and header files.
- Presentationally formats untouched starter Workspaces when a Lesson opens.
- Added Format and confirmed Reset controls for the active editor file.
- Exposed the current Activity's immutable starter files through `WorkspaceView`.
- Kept Format and Reset buffer-only until Save, Run, or Grade uses the existing optimistic-revision persistence contract.
- Preserved existing learner code by disabling automatic formatting whenever any editable file differs from the starter baseline.

## 2. Behavior and safeguards

The formatter tokenizes preprocessor directives, identifiers, numbers, quoted
and raw literals, comments, and operators before rebuilding indentation and
spacing. It does not perform a regular-expression rewrite over literal or
comment bodies. The presentation layer uses two-space indentation and a blank
line after a preprocessor group.

Reset reads only `starterFiles[activePath]`, asks for confirmation, formats the
baseline when it is C/C++, and replaces the browser buffer. The starter baseline
is excluded from PATCH requests. Undoing a change back to the loaded buffer
clears the dirty state; changing source also clears stale Judge output.

## 3. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| `T-EDITOR-001` | Unit tests cover compact input, literals and their suffixes, comments, `for` headers, unary operators, `switch` labels, idempotence, and C/C++ path detection | Passed |
| `T-WORK-001` | In-memory and filesystem Workspace tests prove saved learner files do not change the returned starter baseline | Passed |
| `T-UI-005` | Chromium opens a compact starter as conventional multi-line C++, formats an edited buffer, confirms reset, observes persistence messaging, and proves both tools remain inside the 390-pixel code panel | Passed |
| Static gates | Prettier, ESLint, and TypeScript validate the new contracts and Web implementation | Passed |

## 4. Migration and rollback

The response addition is backward-compatible for consumers that accept unknown
query fields. No learner Workspace file or revision is migrated. Rolling back
the Web controls leaves all saved files readable; rolling back the response
field only removes reset capability and does not alter persisted state.

## 5. Controlled limitations

- This is a local deterministic formatter, not a complete replacement for
  `clang-format`; it intentionally prioritizes safe course snippets and
  predictable offline behavior.
- Non-C/C++ files can be reset but the Format control is disabled.
- Formatting style is currently fixed at two spaces and is not user-configurable.
