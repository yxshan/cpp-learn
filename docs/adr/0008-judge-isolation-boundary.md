---
status: accepted
---

# Judge isolation is a deployment boundary, not a hardening task

Native execution stays the only Judge Adapter, and it is risk-reduced but not a
sandbox: argument arrays with `shell: false`, a disposable root, `HOME` and
`TMPDIR` pointed at that root, a minimal environment, wall-clock and output
limits, and process-group termination. Those controls stop command injection,
runaway output and ordinary infinite loops. They do not stop an admitted program
from reading files the current user can read, opening network connections, or
consuming CPU, memory, process slots and disk until a limit fires.

The project accepts this for one deployment: a single local user, on their own
machine, running reviewed content. Host-level isolation is therefore treated as a
**deployment boundary** rather than an incremental hardening task — it becomes
required before the trust scope widens, not as a gradual improvement to native
mode.

> Update note (2026-09-11): a host-wide Judge admission control now exists
> (one shared budget across Activity Run/Grade and the Reference Playground, with
> a bounded wait queue and `429` back-pressure). It bounds **how many** operations
> run at once; it cannot bound **what one admitted program consumes**. Per-process
> CPU, address-space and process-count limits are not implementable from Node on
> macOS: `child_process` cannot set `RLIMIT_*` for a child, `ulimit` is a shell
> builtin whose use would reintroduce the shell this design removed, and macOS
> enforces `RLIMIT_NPROC` per user rather than per process tree. The remaining
> resource gap therefore closes with the isolation Adapter, not before it.

## Considered options

- Attempt incremental OS-level limits in native mode.
- Require container or lightweight-VM execution from the first release.
- Accept native execution with explicit triggers and an isolation Adapter behind
  the existing Judge seam.

## Consequences

Native mode may only be described as risk-reduced. `README.md`, the security
baseline, and the UI must keep stating that learner code runs with the current
user's privileges, and documentation of the accepted risk is not a claim of
safety. `SECURITY.md` carries the user-facing warning and the reporting channel.

The `Judge` seam already isolates callers from execution: the isolation Adapter
is a new implementation of an existing interface, and the admission control, the
report shape, the cancellation contract and the Learning Record stay unchanged.
Its acceptance criteria are fixed in advance:

- a malicious sample cannot read a host sentinel file, reach the network, observe
  host environment variables, or create processes beyond its budget;
- exceeding a resource budget fails closed, and so does a failure of the
  isolation mechanism itself;
- Reference verification and Authoring example execution use the same Adapter, so
  there is no second, unbounded execution path.

Any of the following makes the isolation Adapter a release blocker rather than a
deferred item: listening on a non-loopback address, multiple accounts, remote
deployment, third-party curriculum packages, shared backups, automatic execution
of generated code, or exposing judging as a public API.

This decision supersedes nothing in
[ADR-0004](0004-native-judge-first.md); it records the boundary at which that ADR
stops applying.
