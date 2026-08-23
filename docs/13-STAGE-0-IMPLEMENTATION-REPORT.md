# Stage 0 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-001 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- npm workspaces for `apps`, domain `modules`, and shared `packages`.
- Strict TypeScript, ESLint, Vitest, Vite production build, document checks, and macOS CI.
- Shared `LearningPlatform` bootstrap query and versioned DTO contracts.
- Curriculum JSON Schema with all-errors validation and one migrated declarative Lesson.
- Workspace editable-path contract rejecting traversal, absolute, backslash, and undeclared paths.
- Native Clang toolchain readiness Adapter using argument-array process execution.
- Local JSONL Learning Record readiness Adapter.
- Fastify HTTP, React Web, and CLI presentation Adapters.
- Local launch instructions and executable `cpplearn doctor` entry point.

No learner program is executed in Stage 0. Judge jobs, editable Workspaces, Attempts, Evidence, progress projections, and AI integration remain in their planned later stages.

## 2. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Modules compile through declared Interfaces | `npm run typecheck` | Passed |
| Web and CLI consume the shared bootstrap DTO | `T-CONTRACT-001` tests | Passed |
| Invalid content fails contract validation | `T-CONTENT-001` | Passed |
| Invalid paths fail the Workspace contract | `T-SEC-001` | Passed |
| Documentation and traceability remain current | `npm run check:docs` | Passed |
| Production Web assets build | `npm run build` | Passed |
| Reference toolchain and data root are ready | `./cpplearn doctor --json` | Passed |

The accepted full gate was:

```bash
npm run check
```

Observed result on the reference environment: 23 controlled Markdown files checked, 8 test files and 14 tests passed, TypeScript and ESLint passed, and Vite produced production assets.

## 3. Manual Web evidence

The local Fastify and Vite services were started on loopback. Browser verification covered:

- desktop dashboard rendering;
- successful `/api/v1/bootstrap` integration;
- real curriculum, Apple Clang, and Learning Record readiness display;
- environment refresh interaction;
- mobile breakpoint behavior at 390 × 844;
- absence of browser console errors and warnings.

## 4. Known limitations

- The Web build is not yet served by Fastify in production mode; development uses the Vite proxy.
- The first Lesson is declarative content but its interactive reader/editor opens in Stage 1.
- JSONL is initialized but event append, recovery, and SQLite projections start in Stage 1–2.
- Native toolchain probing is not Judge sandboxing and must not be treated as one.
- Linux and Windows/WSL verification have not yet been performed.

## 5. Next controlled increment

Stage 1 begins with a single vertical slice: Dashboard → Lesson reader → editable `main.cpp` → revision-safe save → Run → Grade → immutable Judge Report → learning event → refreshed dashboard. Tests will continue to observe the shared Platform, HTTP, CLI, and content seams defined in the design baseline.
