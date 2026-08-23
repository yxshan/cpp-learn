# Production C++ Service Evidence

This reference connects the Stage 6 career Modules to evidence that can be shown in an internship interview. It is a checklist for local, reproducible engineering work rather than a claim that a classroom program is already a production service.

## 1. Service contract

Write the accepted request grammar, response envelope, error categories, ownership boundary, and shutdown behavior before optimizing implementation details. HTTP semantics come from [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110); HTTP/1.1 message parsing comes from [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112).

Evidence to retain:

- representative public contract tests;
- private or transfer tests recorded only as redacted outcomes;
- an explicit unknown-request path;
- an explanation of framing, backpressure, timeout, and cancellation decisions.

## 2. Persistence and concurrency

Use an observed query plan to justify an index; do not infer an index win from its existence. Keep the transaction boundary aligned with the business invariant. The [SQLite query planner](https://www.sqlite.org/queryplanner.html) and [transaction language reference](https://www.sqlite.org/lang_transaction.html) are the primary references used by the Track.

For background work, document task ownership, queue bounds, drain-versus-cancel policy, thread lifetime, and the failure path. The reference implementation stays portable across the supported macOS/Linux toolchains by using `std::thread` with explicit joins; [thread support](https://en.cppreference.com/w/cpp/thread/thread) remains a lookup reference rather than hidden platform behavior.

## 3. Reproducible release evidence

A final Project Workspace should let another engineer reproduce this sequence:

```text
clean configure
→ build named application and test targets
→ run CTest
→ run public/private integration contracts
→ compare repeated baseline/scaled medians
→ inspect install target and Portfolio notes
```

Use the official [CMake testing tutorial](https://cmake.org/cmake/help/latest/guide/tutorial/Testing%20and%20CTest.html) and [`install()` reference](https://cmake.org/cmake/help/latest/command/install.html). Performance evidence is a same-machine relative comparison, not a universal latency promise.

## 4. Operate and explain

Before a load test, state the workload, warm-up, stop condition, expected bottleneck, and rollback threshold. Observe traffic, latency, errors, and saturation; distinguish a user-visible symptom from a suspected internal cause. The Track follows [Google SRE’s monitoring guidance](https://sre.google/sre-book/monitoring-distributed-systems/).

Every final Portfolio should contain:

- exact build and test commands;
- benchmark inputs, repetitions, medians, and interpretation;
- a failure timeline, containment action, root cause, and regression test;
- one design trade-off and the rejected alternative;
- a short explanation linking the Project evidence back to its Concepts.

The platform automates the reproducible checks and keeps the artifacts local. A Teacher Rubric reviews the quality of the explanation; an automated pass alone does not create independent demonstrated Evidence.
