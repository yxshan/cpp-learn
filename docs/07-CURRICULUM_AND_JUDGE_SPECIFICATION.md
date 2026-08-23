# Curriculum and Judge Specification

| Field | Value |
|---|---|
| Document ID | CJS-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Curriculum and Platform Maintainer |
| Last updated | 2026-08-23 |

## 1. Curriculum objective

Provide a job-oriented path from JavaScript/TypeScript front-end experience to modern C++ backend and infrastructure capability. The curriculum is organized by demonstrable Concepts and integrated Projects, not by exhaustive language-standard order.

## 2. Required Track

1. JS/TS to C++ mental-model transition.
2. Compilation, linking, initialization, types, functions, and scope.
3. References, pointers, `const`, value semantics, and lifetime.
4. Classes, composition, RAII, copy/move, smart pointers, and error handling.
5. Standard-library containers, iterators, algorithms, lambdas, optional/variant, and ranges basics.
6. Templates, concepts, and readable generic interfaces.
7. Multi-file projects, Git, CMake, CTest, testing, debugging, Sanitizers, static analysis, and profiling.
8. Data structures, algorithms, complexity, and problem solving.
9. Processes, threads, virtual memory, files, system calls, and Linux tools.
10. TCP/UDP, sockets, HTTP, blocking/non-blocking I/O, and event-loop fundamentals.
11. SQL, indexes, transactions, SQLite/PostgreSQL, caching, and persistence.
12. Concurrency, thread pools, races, deadlocks, atomics, memory model basics, and performance measurement.
13. Integrated Projects, code review, design explanation, deployment, load testing, incident diagnosis, and interview review.

Optional Tracks include advanced templates, coroutines, storage engines, RPC/distributed systems, AI infrastructure, games, audio/video, clients, compilers, and ABI.

## 3. Content units

- **Lesson**: 20–45 minutes, one narrow objective, primary source, retrieval step, and tangible win.
- **Exercise**: executable or reviewable artifact with a public contract and Evidence policy.
- **Review**: delayed variant requiring recall or transfer.
- **Project Milestone**: persistent realistic increment with automated and qualitative acceptance.
- **Reference**: concise reusable material optimized for later lookup.

## 4. Activity manifest

```json
{
  "schemaVersion": 1,
  "id": "cpp.references.01",
  "version": 1,
  "kind": "exercise",
  "title": "References are not JavaScript object references",
  "estimatedMinutes": 35,
  "conceptIds": ["cpp.references.use", "cpp.const.read"],
  "prerequisiteIds": ["cpp.functions.basic"],
  "content": { "lesson": "lesson.md" },
  "workspace": {
    "starter": "starter",
    "editable": ["solution.cpp"]
  },
  "judge": {
    "profile": "cpp-function",
    "standard": "c++20",
    "stages": ["compile", "public", "private", "asan", "ubsan", "timeout"]
  },
  "evidencePolicy": {
    "publicPass": "practiced",
    "demonstratedRequires": ["private-pass", "reflection-pass", "independent"]
  },
  "reviewIds": ["cpp.references.review.01"]
}
```

The manifest selects fixed judge capabilities. It cannot embed arbitrary shell commands.

## 5. Interactive lesson blocks

Allowed blocks are typed and registered by the platform, for example:

```text
code-compare
memory-visualization
lifetime-timeline
container-visualization
algorithm-trace
network-flow
quiz
exercise
reflection
```

Each block has a JSON Schema and deterministic fallback content for printing or unsupported displays. Arbitrary MDX execution is forbidden.

## 6. Judge profiles

### CLI I/O

Compiles one or more files and evaluates stdin/stdout using exact, token, normalized-line, regular-expression, or floating-tolerance comparison.

### Function harness

Learner implements a header contract; public and private harnesses call it. Symbol and include contracts are checked before runtime tests.

### Compile diagnostics

The expected result may be compilation failure, warning removal, or diagnosis. Compiler-family differences must be normalized carefully.

### Algorithm

Uses examples, deterministic generated properties, edge cases, large inputs, and optional relative performance checks. Failed generated cases retain a reproducible seed.

### System lab

Uses temporary files, child processes, threads, loopback sockets, dynamic ports, or SQLite fixtures. External network access is not required.

### CMake/project

Configures a clean build, builds named targets, executes CTest or integration probes, and verifies regression behavior across Milestones.

## 7. Judge pipeline

```text
source contract
  → compile
  → public tests
  → private property tests
  → ASan / UBSan
  → timeout / output limit
  → optional concurrency / performance
  → optional teacher review
  → immutable report
```

Blocking stage failures stop unsafe or meaningless later stages. Style, formatting, and ordinary performance observations are advisory unless the Activity explicitly teaches them.

## 8. Feedback policy

- Public tests may show input, expectation, and actual result.
- Private tests show the violated property category, not the exact hidden input.
- Compiler and Sanitizer diagnostics retain original text plus a safe explanation.
- A deterministic generated failure may expose a minimized counterexample after the Grade, unless doing so would reveal a reference solution.
- Hints are ordered disclosures. Each use is recorded before content is returned.
- A complete solution requires explicit confirmation and triggers a new Review variant.

## 9. Evidence policy

- Reading creates exposure only.
- A Run creates no Concept-state Evidence.
- Public checks can support `practiced`.
- `demonstrated` normally requires private/transfer behavior, reflection or teacher review, and sufficient independence.
- `retained` requires delayed evidence from a Review or Project context.
- One Activity may contribute Evidence to several Concepts, but failure updates only applicable Concepts.

## 10. Content quality gate

Every required Activity must have:

- Stable ID and version.
- Objective and victory condition.
- Estimated time and prerequisites.
- Primary source and reference links.
- Valid starter files and editable-path contract.
- Public tests and a passing reference implementation.
- Private property coverage where appropriate.
- At least two graded hints without answer leakage.
- Reflection or explanation prompt when needed.
- Evidence policy and delayed Review variant.
- Print/read-only fallback for interactive content.

## 11. Target scale

Long-term target:

- 80–120 micro-lessons.
- 120–180 Exercises and Review variants.
- 20–30 system labs.
- 4–5 progressive Projects.

Initial validated release:

- 10–12 Lessons.
- 15–20 Exercises/Reviews.
- One progressive Project.

Content is expanded only after the platform can lint, judge, migrate, and trace it.

## 12. Initial Projects

- Modern C++ CLI data manager.
- Local key-value store or log index.
- C++ HTTP service with persistence and observability.
- Thread pool/task queue and failure diagnostics.
- React/TypeScript front end with C++ service and SQLite/PostgreSQL.
