# Development and Operations Guide

| Field | Value |
|---|---|
| Document ID | DEVOPS-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Supported baseline

- Apple Silicon macOS.
- Node.js and npm versions compatible with the locked toolchain.
- Apple Clang with C++20 support.
- CMake and Git.
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
./cpplearn doctor
```

Until implementation exists, these commands are normative targets rather than current executable commands.

## 3. Local startup

`./cpplearn serve` shall:

1. Resolve configuration and data roots.
2. Acquire the single-writer lock.
3. Validate/recover the event log.
4. Validate content and activate the catalog.
5. Check required toolchain capabilities.
6. Start the HTTP Adapter on loopback.
7. Open or print the local Web URL.

Startup shall fail safely if the event log is not recoverable or required content is invalid.

## 4. Configuration

Planned keys:

```text
server.host
server.port
paths.curriculum
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

## 5. Logging and observability

- Structured JSON logs in production mode; readable logs in development.
- Correlation ID on HTTP command, Judge job, Attempt, and event append.
- Log level, Module, event name, duration, and safe outcome.
- No source code, reflections, private inputs, or environment secrets in normal logs.
- `doctor --json` emits toolchain, paths, schema versions, storage health, and capability probes.

## 6. Data operations

### Backup

```bash
cpplearn export --output <explicit-path>
```

Export creates a checksummed archive of events, Workspaces, retained snapshots, Learning Records, and configuration. It excludes caches and private judge content.

### Restore

Restore writes to a new validated data root, verifies checksums and schemas, rebuilds projections, and only then makes the root active.

### Projection rebuild

```bash
cpplearn doctor --rebuild-projections
```

Rebuild never modifies the source event log.

## 7. Content authoring workflow

1. Reserve stable Activity and Concept IDs.
2. Add manifest, lesson content, starter, tests, hints, reflection, references, and Review variant.
3. Run content lint and reference-solution judge.
4. Verify known incorrect/mutated solutions.
5. Review teaching load, terminology, and answer leakage.
6. Merge only after traceability and content quality gates pass.

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

