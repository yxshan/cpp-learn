# Development and Operations Guide

| Field | Value |
|---|---|
| Document ID | DEVOPS-001 |
| Version | 1.8 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-09-05 |

## 1. Supported baseline

- Apple Silicon macOS.
- Node.js and npm versions compatible with the locked toolchain.
- Apple Clang with C++20 language support for the native Judge baseline.
- A standard library implementing the features used by Reference examples;
  Reference verification prefers an installed Homebrew LLVM when available.
- CMake and Git.
- SQLite development headers/library supplied by the reference macOS SDK.
- Modern Chromium/WebKit browser for development.

Exact versions will be recorded by `cpplearn doctor` and release manifests.

## 2. Repository workflow

The implementation will use npm workspaces. Expected commands after scaffolding:

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run check:reference
npm run check:reference-quality
npm run report:reference
./cpplearn doctor
```

These commands are executable. `npm run test:e2e` starts dedicated loopback API
and Vite services for the controlled Chromium flow. They use temporary data and
Workspace roots plus ports separate from the normal `127.0.0.1:4173` service;
the test runner does not reuse an existing learner server.

`npm run check:content` executes the system-lab references. It therefore needs normal local permission to create temporary files/processes, bind `127.0.0.1` on a dynamic port, link SQLite, and invoke CMake/CTest. It never requires external network access.

## 3. Local startup

After `npm run build`, `./cpplearn serve`:

1. Resolves the current local data and Workspace roots.
2. Initializes the append-only JSONL event log.
3. Validates content and activates the catalog.
4. Starts the HTTP API and built Web assets on `127.0.0.1:4173`.
5. Prints the local Web URL.

Startup fails safely if required content or built Web assets cannot be read. The Learning Record repairs an interrupted trailing append by quarantining invalid bytes and recording `recovery.performed`; SQLite projections are rebuilt from the valid event log during initialization. A learning action may persist one event or a checksummed event batch, but each action occupies one JSONL line and is projected in one SQLite transaction.

## 4. Configuration

Planned keys:

```text
server.host
server.port
paths.curriculum
paths.reference
paths.workspaces
paths.data
paths.privateJudge
judge.mode
judge.maxConcurrentJobs
judge.defaultTimeoutMs
judge.maxOutputBytes
retention.runSnapshotDays
logging.level
```

Secrets are not expected in the base product. Environment variables are allowlisted and never forwarded wholesale to learner processes.

The server accepts `CPP_LEARN_DATA_ROOT` and `CPP_LEARN_WORKSPACE_ROOT` as
explicit storage overrides. They support controlled test and maintenance
composition roots; omitting them retains the default learner paths. The Web
development proxy accepts `CPP_LEARN_API_URL`, while production static serving
continues to use same-origin `/api` routes.

`CPP_LEARN_REFERENCE_COMPILER` selects the Reference verification compiler by
an existing absolute path. Without it, the Reference selector checks the
standard Homebrew LLVM paths and then falls back to `/usr/bin/clang++`.
Reference checks, coverage reporting, and the server-side verification
fingerprint share this selection. The native Judge remains on the documented
system Apple Clang baseline. After changing the Reference compiler, rerun
`npm run check:reference` and start the server with the same variable.

## 5. Logging and observability

- Structured JSON logs in production mode; readable logs in development.
- Correlation ID on HTTP command, Judge job, Attempt, and event append.
- Log level, Module, event name, duration, and safe outcome.
- No source code, reflections, private inputs, or environment secrets in normal logs.
- `doctor --json` emits toolchain, paths, schema versions, storage health, and capability probes.

## 6. Data operations

### Learning-loop CLI

```bash
cpplearn progress [--json]
cpplearn reviews [--due] [--json]
cpplearn hint --activity ID --attempt ID --hint ID [--confirm-solution]
cpplearn reflect --activity ID --attempt ID --prompt ID --answer TEXT
cpplearn check --activity ID --attempt ID
```

Use one Attempt ID across hint, reflection, and check commands. Assistance and human reflections are private local Learning Records: they may enter an explicit backup or Teacher Pack preview but never normal logs.

### Backup

```bash
cpplearn export --output <explicit-path>
```

Export creates a checksummed archive of events, Workspaces, retained snapshots, Learning Records, and configuration. It excludes caches and private judge content.

### Restore

```bash
cpplearn restore --input <explicit-path>
```

Restore verifies manifest shape, safe paths, file checksums, and event envelopes before mutation. It writes new staged data and Workspace roots, swaps them into place only after validation, and retains the previous roots with a `.pre-restore-*` suffix for recovery. Restart the local service after a Web restore.

### Projection rebuild

```bash
cpplearn doctor --rebuild-projections
```

The Learning Record exposes rebuild through its maintenance Interface and automatically rebuilds during startup. A dedicated `doctor --rebuild-projections` presentation command remains planned. Rebuild never modifies the source event log.

## 7. Content authoring workflow

### Curriculum Activities

1. Reserve stable Activity and Concept IDs.
2. Add manifest, lesson content, starter, tests, hints, reflection, references, and Review variant.
3. Run content lint and reference-solution judge.
4. Verify known incorrect/mutated solutions.
5. Review teaching load, terminology, and answer leakage.
6. Merge only after traceability and content quality gates pass.

### C++ Reference Entries

1. Reserve a stable Entry ID and slug in the Reference catalog.
2. Add manifest, original Markdown, sources, and standalone example files.
3. Run Reference schema, path, relationship, link, attribution, and search
   fixtures.
4. Compile examples under their declared standard and warning profile.
5. Verify signatures, standard status, complexity, lifetime, and invalidation
   claims against primary sources.
6. Review terminology and learner usability using the [Reference Authoring
   Guide](23-API-REFERENCE-CONTENT-AUTHORING-GUIDE.md).
7. Run `check:reference-quality`; new Entries must pass their kind profile, and
   remediation changes remove resolved rows from the quality baseline.
8. Merge only after the complete Reference catalog activates and the production
   Web route renders offline.

`npm run check:reference` validates the active catalog, compiles every example
under its declared C++ standard and strict warning profile, runs executable
examples, and compares exact expected output. Only after the complete catalog
passes does it atomically replace the local verification manifest. By default
the manifest is written to
`.cpp-learn/data/reference-verification.json`; `CPP_LEARN_DATA_ROOT` selects the
same alternate data root used by the server.

`npm run report:reference` loads that manifest when it matches the current
compiler fingerprint, catalog version, example standard, and source digest.
It reports stale, missing, malformed, or unlisted records as `not-checked`.
The report also includes the number of structurally audited Entries, reviewed
quality gaps, affected Entries, and findings grouped by quality area.
Run `check:reference` after changing Reference examples, switching compiler
toolchains, or updating the catalog version, then run `report:reference` to
inspect coverage. The manifest is a rebuildable local cache: it is excluded
from Git and learner backups and is not a substitute for the release gate.

`npm run check:reference-quality` does not compile examples. It audits Markdown
structure and manifest counts by Entry kind, then requires an exact match with
`reference/quality-baseline.json`. A fixed finding must be removed from the
baseline in the same change; a new finding must be corrected rather than
baselined. Genuinely irrelevant items require a dated `notApplicable` reason.
The baseline carries review provenance and accepted Entry versions; versioning
an indebted Entry invalidates its inherited allowance. Catalog version changes
require an explicit baseline review.

## 8. Dependency management

- Commit `package-lock.json`.
- Prefer dependencies with active maintenance, clear licenses, and direct value.
- Review transitive additions and native build requirements.
- Upgrade through a dedicated change with tests and release notes.
- Do not import framework abstractions into the Learning Platform Interface.

## 9. Release process

1. Freeze intended scope and update SRS/traceability where needed.
2. Pass quality gates from [Test and Quality Plan](09-TEST_AND_QUALITY_PLAN.md).
3. Verify event and content migrations from the previous release.
4. Create backup/restore smoke artifact.
5. Build Web assets and CLI/server packages.
6. Record toolchain and dependency manifests.
7. Publish local release notes, known limitations, and rollback procedure.

## 10. Rollback

- Platform binaries and Web assets can roll back independently of learner data only if event/content compatibility is preserved.
- Before a breaking migration, create an automatic backup.
- Never downgrade by mutating events. Use a compatible older reader or restore the pre-migration backup.

## 11. Documentation maintenance

- Update document version and date for normative changes.
- Keep archived proposals unchanged except for archive metadata.
- Add ADRs only for hard-to-reverse, surprising trade-offs.
- Run link, identifier, and traceability checks before release.
