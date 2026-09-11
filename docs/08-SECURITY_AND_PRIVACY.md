# Security and Privacy

| Field | Value |
|---|---|
| Document ID | SEC-001 |
| Version | 1.5 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-11 |

## 1. Security posture

The initial product is a single-user local application. The Learner and curriculum repository are trusted to a limited degree; compiled programs are treated as unreliable and potentially harmful. Native execution is risk-reduced but is not a security sandbox.

The implementation status and unresolved risks at commit `8f99f7e` are recorded
in [the current security audit](71-CURRENT-SECURITY-AUDIT.md), which also carries
the remediation status of each finding. Controls in this document are
requirements; the audit distinguishes controls already implemented from controls
that remain planned. The reporting channel and the accepted native-execution
risk are stated in [`SECURITY.md`](../SECURITY.md).

## 2. Protected assets

- Learner source code and Workspace history.
- Learning events, reflections, and Teacher Observations.
- Private judge material and reference solutions.
- Host filesystem, processes, credentials, and network access.
- Integrity of Judge Reports and Concept-state Evidence.
- Integrity, authorship, attribution, and source metadata of Reference content.
- Platform dependencies and release artifacts.

## 3. Trust zones

```text
Browser UI
  ↓ validated localhost HTTP
Fastify + Learning Platform
  ↓ immutable job specification
Judge Worker
  ↓ untrusted native process
Learner executable
```

The browser never receives private judge files. The Judge Worker receives no direct Learning Record write capability. The learner executable receives a minimal environment and temporary working directory.

## 4. Threats and controls

### Command injection

Controls:

- Use `spawn`/equivalent with executable and argument array.
- Never concatenate learner values into a shell string.
- Allowlist compiler, CMake, and runtime executables resolved at startup.
- Reject curriculum manifests containing arbitrary commands.

### Path traversal and symlink escape

Controls:

- Normalize and validate every Workspace path.
- Reject absolute paths, `..`, symlinks, devices, and paths outside configured roots.
- Copy Source Snapshots into fresh judge directories instead of compiling in mutable Workspaces.
- Validate archive extraction paths before writing.

### Resource exhaustion

Controls:

- Wall-clock timeout and process-group termination.
- stdout/stderr byte limits.
- A bounded queue and shared concurrency limit across every Judge entry point.
  One `JudgeAdmission` per host process serves both Activity Run/Grade and the
  Reference Playground; `run` waits in a bounded FIFO queue, `tryAcquire`
  refuses instead of waiting, and saturated admission answers `429` with
  `Retry-After`. Slots are released on success, on failure, and on cancellation.
- Input and file-size limits.
- Optional CPU/memory/container controls when the container Adapter is available.
- Judge health monitoring and back-pressure.

Native macOS mode has no per-process CPU, address-space, or process-count limit,
so it cannot reliably prevent every fork bomb or memory exhaustion, and it cannot
confine host reads. Only trusted learner code is permitted in this mode. The
shared admission limit is implemented, but it bounds concurrent Judge work, not
what a single admitted program may consume.

### Host filesystem or network access

Controls:

- Judge temporary directory and minimal environment; `HOME` and `TMPDIR` both point at the per-Grade root.
- No secrets in inherited environment variables.
- Network Activities use loopback and dynamic ports.
- A future container Adapter denies external network and mounts only required files.

Native mode cannot guarantee filesystem confinement; UI copy must state this limitation.

### Private-test disclosure

Controls:

- Keep private judge material outside public curriculum and browser bundles.
- Redact exact private inputs/expectations from reports.
- Exclude private files from Teacher Packs and exports.
- Prevent generic error handlers from returning worker command lines containing private paths.

Local concealment is pedagogical only. It is not an anti-cheat control against the machine owner.

### Record tampering or duplicate ingestion

Controls:

- Append-only event IDs and checksums.
- Idempotent command and report receipts.
- Immutable Judge Reports with source and toolchain digests.
- Projection rebuild and consistency verification.

The local Learner ultimately controls the files; records are self-learning evidence, not a tamper-proof certificate.

### Dependency and content supply chain

Controls:

- Commit lockfiles.
- Review dependency changes and run vulnerability/license checks.
- Run `npm run check:security`: production advisories fail the gate unless a
  dated exemption in `security/audit-exemptions.json` names a reason and an
  owner, and the tracked tree plus every revision is scanned for credentials.
- Keep a dependency whose code ships at the reviewed version. A copy vendored
  inside another dependency is redirected at build time, so the lockfile, the
  advisory database, and the shipped bundle cannot disagree.
- Pin release dependencies; do not execute package lifecycle scripts from untrusted content.
- Pin CI Actions to full commit SHAs and let Dependabot propose the upgrades.
- Validate curriculum schemas and reference solutions before activation.
- Validate Reference manifests, confined content/example paths, Markdown,
  relationships, sources, and reused-material attribution before activation.
- Treat imported curriculum as code until reviewed.
- Do not scrape, machine-translate, or automatically publish external Reference
  content; original reviewed content is the default.

### Reference rendering and search

Controls:

- Render Reference Markdown through the declarative safe renderer; reject raw
  scripts, MDX, event attributes, and unsafe URL schemes.
- Treat search text only as bounded data; never pass it to a filesystem lookup,
  regular-expression constructor, SQL string, or shell.
- Keep repository paths and authoring diagnostics out of public DTOs.
- Mark external source links and apply safe new-tab behavior consistently.
- Browsing, searching, and copying are read-only and append no learning event.
- The local Playground uses a temporary non-Activity root, a closed compiler
  profile, source/output limits, timeout, process cleanup, and admission drawn
  from the same host Judge budget as Activity Run/Grade, which defaults to one
  concurrent operation. Busy requests receive bounded back-pressure rather than
  starting another compiler. Client-created UUIDv4 run identities are registered
  only while active; duplicate active identities fail closed, and cancellation
  crosses the same origin-validated local HTTP boundary.

### Local HTTP exposure

Controls:

- Bind to `127.0.0.1` by default.
- Reject non-loopback binding without explicit configuration and warning.
- Validate `Origin` for state-changing requests.
- Add a random per-start local session token before the trust scope expands; it is not implemented in the current baseline.
- Do not enable permissive CORS.

## 5. Privacy

Default local data may include code, timestamps, study duration, assistance history, reflections, and inferred misconceptions. It shall not leave the machine without an explicit export or configured remote Adapter.

Logs should use identifiers and summaries instead of full source. Crash reports and Teacher Packs require preview before external sharing.

## 6. Data retention

- Grade snapshots and supporting Evidence are retained by default.
- Unreferenced Run snapshots may be compacted under a documented policy.
- Raw worker logs have bounded retention and exclude private inputs where possible.
- Exports and backups are explicit Learner actions.
- Deleting learning history requires confirmation and a recoverable backup recommendation.

## 7. Security verification

- Injection tests for arguments, paths, environment variables, and content manifests.
- Symlink, traversal, archive-slip, and Unicode path tests.
- Timeout, output flood, child-process, and cancellation tests.
- Private-data redaction tests for HTTP, SSE, logs, Teacher Packs, and exports.
- Loopback binding and origin-validation tests.
- Event tampering and duplicate-report tests.
- Dependency and secret scanning in CI (`npm run check:security`), with
  `npm run test:security` proving that a controlled advisory and a controlled
  credential fixture both fail the gate.
- Shared Judge admission tests: concurrent Activity Runs respect the configured
  limit, the Playground and Activity Run draw on one budget, overload answers
  `429` with `Retry-After`, ordinary queries keep working while saturated, and a
  slot is released after success, failure, and cancellation.
- Reference path, Markdown, external-link, relationship, attribution, search-
  bound, and no-learning-state-mutation tests.

## 8. Incident handling

On suspected corruption or unsafe execution:

1. Stop new Judge admission.
2. Preserve relevant event/log files without executing learner binaries.
3. Run `doctor` and record correlation/job identifiers.
4. Restore from a known backup or rebuild projections.
5. Document root cause and add a regression test.
6. Create or supersede an ADR if the threat changes a hard-to-reverse architecture decision.
