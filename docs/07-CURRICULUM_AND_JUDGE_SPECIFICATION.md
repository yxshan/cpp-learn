# Curriculum and Judge Specification

| Field | Value |
|---|---|
| Document ID | CJS-001 |
| Version | 1.5 |
| Status | Baseline |
| Owner | Curriculum and Platform Maintainer |
| Last updated | 2026-08-25 |

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
- **Reference Entry**: concise reusable lookup material owned by the separate
  Reference Module. It is not an Activity and has no Evidence policy.

## 4. Activity manifest

```json
{
  "schemaVersion": 1,
  "id": "cli-data-manager-m1",
  "version": 2,
  "kind": "project-milestone",
  "title": "Project：CLI 数据管理器 Milestone 1",
  "project": {
    "id": "cli-data-manager",
    "title": "现代 C++ CLI 数据管理器",
    "milestone": 1,
    "milestoneCount": 3,
    "portfolioOutcome": "一个具备多文件模型、持久工作区与 CMake/CTest 的现代 C++ CLI 项目。"
  },
  "estimatedMinutes": 60,
  "conceptIds": [
    "cpp-classes",
    "cpp-stl-containers",
    "cpp-multi-file"
  ],
  "prerequisiteIds": [
    "cmake-testing-debugging",
    "stl-containers-algorithms"
  ],
  "objectives": [
    "建立可持续扩展的多文件 CLI 数据模型。"
  ],
  "victoryConditions": [
    "读取名称和分数，并通过独立格式化函数输出 name=score。"
  ],
  "sources": [
    {
      "kind": "primary",
      "title": "C++ Core Guidelines: interfaces",
      "url": "https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#S-interfaces"
    },
    {
      "kind": "reference",
      "title": "CMake tutorial",
      "url": "https://cmake.org/cmake/help/latest/guide/tutorial/index.html"
    }
  ],
  "content": {
    "format": "markdown",
    "path": "activities/cli-data-manager-m1/lesson.md"
  },
  "workspace": {
    "persistenceId": "cli-data-manager",
    "editablePaths": [
      "main.cpp",
      "record.cpp",
      "record.hpp"
    ],
    "starterFiles": {
      "main.cpp": "#include \"record.hpp\"\nint main() { /* TODO */ }\n",
      "record.hpp": "#pragma once\n#include <string>\nstruct Record { std::string name; int score; };\n",
      "record.cpp": "#include \"record.hpp\"\nstd::string format_record(const Record& record) { /* TODO */ }\n"
    }
  },
  "judge": {
    "version": 1,
    "expectedStdout": "alice=42\n",
    "timeoutMs": 3000,
    "publicTests": [
      {
        "name": "format record",
        "stdin": "alice 42\n",
        "expectedStdout": "alice=42\n"
      }
    ]
  },
  "evidencePolicy": {
    "automatedPass": true,
    "demonstratedRequiresReflection": true,
    "demonstratedRequiresIndependent": true,
    "reviewAfterDays": 7,
    "teacherReviewRequired": true
  },
  "learning": {
    "hints": [
      {
        "id": "to-string",
        "title": "转换分数",
        "kind": "nudge",
        "content": "std::to_string 把 int 转成 string。"
      },
      {
        "id": "pure-format",
        "title": "保持格式化函数纯粹",
        "kind": "concept",
        "content": "只从 const Record& 构造返回字符串，不直接读写流。"
      }
    ],
    "reflections": [
      {
        "id": "project-boundary",
        "prompt": "为什么把格式化逻辑从 main 分离后更容易测试和扩展？",
        "required": true
      }
    ],
    "reviewIds": [
      "classes-and-raii-review"
    ],
    "teacherRubric": {
      "id": "project-boundary-rubric",
      "prompt": "回答应联系纯函数、稳定接口与未来输出格式扩展。"
    }
  },
  "quality": {
    "referenceFiles": {
      "main.cpp": "#include \"record.hpp\"\n#include <iostream>\nint main() { Record r{\"alice\", 42}; std::cout << format_record(r) << '\\n'; }\n",
      "record.hpp": "#pragma once\n#include <string>\nstruct Record { std::string name; int score; };\nstd::string format_record(const Record& record);\n",
      "record.cpp": "#include \"record.hpp\"\nstd::string format_record(const Record& r) { return r.name + \"=\" + std::to_string(r.score); }\n"
    },
    "mutations": [
      {
        "id": "omit-score",
        "files": {
          "main.cpp": "#include \"record.hpp\"\n#include <iostream>\nint main() { Record r{\"alice\", 42}; std::cout << format_record(r) << '\\n'; }\n",
          "record.hpp": "#pragma once\n#include <string>\nstruct Record { std::string name; int score; };\nstd::string format_record(const Record& record);\n",
          "record.cpp": "#include \"record.hpp\"\nstd::string format_record(const Record& r) { return r.name; }\n"
        },
        "expectedVerdict": "public_failure"
      }
    ],
    "interactiveBlocks": [
      {
        "id": "project-dependencies",
        "type": "algorithm-trace",
        "fallback": "stdin -> main -> Record -> format_record -> stdout"
      }
    ],
    "printFallback": "画出 main、Record 与 format_record 的依赖方向。"
  }
}
```


This is `curriculum/activities/cli-data-manager-m1/activity.json` with its inline C++ shortened; the canonical shape is `packages/content-schema/src/activity.schema.json` and the canonical example is that file. Every field above is required by the schema, including `objectives`, `victoryConditions`, `sources`, `learning` and `quality`.

The `project` object is required only for `project-milestone` Activities. Its ID must match `workspace.persistenceId`; every Project must declare one contiguous Milestone sequence with a stable title, count, and portfolio outcome.

The manifest selects fixed judge capabilities through `judge.version`, `expectedStdout`, `timeoutMs`, `publicTests`, `propertyTests`, `performanceCheck`, `buildProfile` and `sanitizers`. It cannot embed arbitrary shell commands.

Fixed private-test inputs and expected outputs are not Activity-manifest fields. They live in the server-only `judge-private/tests.json` registry keyed by Activity ID. Catalog activation rejects any public manifest that declares a `judge.privateTests` key, rejects registry entries for unknown Activities, and validates the internally merged definition before use.

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

The initial fixed generator produces bounded integer vectors and compares learner output with a sorting oracle. Generator kind, bounds, case count, and 32-bit seed are declarative. Performance checks use Activity-owned baseline/scaled stdin and expected stdout, reject incorrect results, alternate repeated runs on one machine, and compare medians against a declared ratio.

### System lab

Uses temporary files, child processes, threads, loopback sockets, dynamic ports, or SQLite fixtures. External network access is not required.

The initial system Module is POSIX-compatible on the reference macOS environment and Linux: it does not infer Linux-only behavior. Network Activities bind `127.0.0.1:0`; SQLite links only the allowlisted local library. All artifacts live under the per-Grade temporary root.

### CMake/project

Configures a clean build, builds named targets, executes CTest or integration probes, and verifies regression behavior across Milestones.

The manifest names one application target and one test target using identifiers that cannot be parsed as command options. It cannot provide arbitrary configure/build commands or shell hooks. Reports capture the inspected CMake and CTest version lines.

The optional `runtimeTools` list is a closed capability set: `node`, `git`, and `web-frontend`. The composition root/Judge resolves them respectively to the trusted Node executable, Git executable, and platform-owned Vite/React build-and-mount harness, then injects those absolute paths into CMake through an argument array. Before configure it performs bounded version/fingerprint probes; the immutable report records Node/Git versions and the Web harness SHA-256 plus Vite/React versions. A missing or incompatible declared capability is a system/toolchain failure, not a Learner CTest failure. Activity manifests cannot provide runtime paths, environment-variable names, dependency-install commands, or arbitrary configure arguments. `web-frontend` must validate a pinned `package.json`, perform a production TSX build from the clean Workspace, execute a component mount test, and remove disposable output.

## 7. Judge pipeline

```text
source contract
  → direct compile OR clean CMake configure/build
  → optional CTest
  → public tests
  → private fixed tests
  → deterministic generated properties
  → ASan / UBSan
  → timeout / output limit
  → optional same-machine relative performance
  → optional teacher review
  → immutable report
```

Blocking stage failures stop unsafe or meaningless later stages. Style, formatting, and ordinary performance observations are advisory unless the Activity explicitly teaches them.

## 8. Feedback policy

- Public tests may show input, expectation, and actual result.
- Private fixed/performance tests show the violated property category, not exact hidden inputs or expected outputs; content validation rejects those values in every Hint tier.
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

Validated Stage 6 release:

- 70 Lessons, Exercises, Reviews, and Project Milestones.
- 5 progressive Projects with 11 persistent Milestones.
- 10 career Modules, each with a delayed Review: network-service contracts, persistence/query plans, concurrent task queues, production readiness, modern optional/variant/ranges vocabulary, Git/static-analysis/profiling diagnostics, virtual memory/Linux tools, UDP/non-blocking event loops, caching/PostgreSQL boundaries, and deadlock/memory-model reasoning.
- Final career Project Milestones use clean CMake builds, named targets, CTest, integration inputs, same-machine relative performance checks, Portfolio documentation, and qualitative failure-retrospective rubrics.

Content is expanded only after the platform can lint, judge, migrate, and trace it.

## 12. Initial Projects

- Modern C++ CLI data manager.
- Local key-value store or log index.
- C++ HTTP service with persistence and observability.
- Thread pool/task queue and failure diagnostics.
- React/TypeScript front end with a versioned C++ service boundary and persistence integration.
