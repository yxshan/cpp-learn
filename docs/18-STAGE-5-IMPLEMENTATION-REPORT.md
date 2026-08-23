# Stage 5 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-006 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- A deterministic algorithm profile with bounded integer-vector generation, fixed seeds, sorting oracle, replayable counterexamples, and `property_failure`.
- A same-machine relative performance profile that alternates baseline/scaled input, uses median durations, records the growth ratio, and emits `performance_failure`.
- Fixed direct-build capabilities for thread support and allowlisted SQLite linkage.
- A declarative CMake profile that performs clean configure, named application/test target build, CTest, and final integration tests without manifest shell commands.
- POSIX file/process, thread/atomic, dynamic loopback HTTP, and isolated SQLite transaction Activities with delayed Reviews.
- CLI data manager Milestone 3, preserving the Milestone 1/2 Workspace while adding CMake and CTest files.
- Web Judge output for seeds, generated counterexamples, and relative performance measurements.

## 2. Release inventory

Stage 5 adds 11 Activities to the Stage 4 baseline:

| Kind | Count added | Capability |
|---|---:|---|
| Lesson | 5 | Properties, files/processes, threads, loopback HTTP, SQLite |
| Exercise | 1 | Same-machine complexity growth |
| Review | 4 | Delayed algorithm, runtime, HTTP, and transaction retrieval |
| Project Milestone | 1 | Clean CMake/CTest engineering workflow |

The complete Track now contains 38 Activities. The CLI data manager is one persistent Project with three independently verifiable Milestones.

## 3. Acceptance evidence

| Acceptance statement | Evidence | Result |
|---|---|---|
| Generated failure reproduces | `T-JUDGE-006` repeats the same seed and obtains the same stdin/counterexample | Passed |
| Performance is same-machine relative | `T-JUDGE-007` derives verdict from baseline/scaled medians and ratio | Passed |
| System resources are cleaned | `T-SYSTEM-001`, bounded-process timeout/cancellation tests, and per-Activity cleanup behavior | Passed |
| Loopback is offline and conflict-free | Reference Activity binds `127.0.0.1:0` and completes a local HTTP round trip | Passed |
| SQLite fixture is isolated | Reference/Review Activities create, query, close, and remove databases under the Grade root | Passed |
| CMake/CTest is real | M3 clean-configures, builds named app/test targets, passes CTest, and passes CLI integration tests | Passed |
| Content mutations hit intended stages | `npm run check:content` Grades 38 starters, 38 references, and 38 mutations | Passed |

Reproduce the release gates with:

```bash
npm run check
npm run test:e2e
```

The content gate needs normal local permission to bind a loopback dynamic port. It never connects to an external address.

## 4. Safety and portability

Judge specifications select fixed generator, oracle, library, thread, and build capabilities. They cannot embed process arguments or shell hooks. Native execution remains the documented trusted local mode, not a hostile-code sandbox.

System programs run with a minimal environment under a unique temporary root. Timeout or cancellation kills the learner process group. The Judge deletes the root after success, failure, cancellation, or worker exception. Loopback Activities own both endpoints and use a dynamic port. SQLite files are local fixtures.

The released process/socket code uses POSIX interfaces verified on the reference macOS environment and applicable Linux environments. No Linux-only result is inferred from macOS. Optional container/Linux matrix execution remains an additional compatibility adapter, not evidence produced by this release.

## 5. Known limitations

- The generated-property registry initially contains the integer-vector sorting profile; future fixed generators cover graphs, strings, parsers, and state machines.
- Relative performance checks reduce noise with alternating medians but cannot prove an asymptotic bound; they are supporting Evidence tied to the declared Activity.
- The Native Judge does not isolate hostile code from the host. Container-safe execution remains deferred.
- Loopback and POSIX Activities require corresponding local OS capabilities; the current readiness probe reports the compiler but does not yet expose capability-by-capability availability.
- Web renders property and performance evidence textually; specialized charts and counterexample replay controls remain future UI work.

## 6. Next controlled increment

Stage 6 completes the career track with additional projects, knowledge-map/project traceability, deployment and observability work, load testing, incident diagnosis, interview review, and advanced visualizations.
