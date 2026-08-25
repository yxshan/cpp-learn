# C++ Learning Platform Documentation

| Field | Value |
|---|---|
| Document ID | DOC-INDEX |
| Version | 2.1 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## Purpose

This directory is the controlled documentation baseline for the local, Web-first C++ learning platform. Current documents define product scope, requirements, architecture, interfaces, data, curriculum, judging, security, testing, operations, and delivery acceptance.

## Current baseline

Read in this order:

1. [Project Charter](01-PROJECT_CHARTER.md)
2. [Software Requirements Specification](02-SOFTWARE_REQUIREMENTS_SPECIFICATION.md)
3. [System Architecture](03-SYSTEM_ARCHITECTURE.md)
4. [Detailed Design](04-DETAILED_DESIGN.md)
5. [Interface Contracts](05-INTERFACE_CONTRACTS.md)
6. [Data Design](06-DATA_DESIGN.md)
7. [Curriculum and Judge Specification](07-CURRICULUM_AND_JUDGE_SPECIFICATION.md)
8. [Security and Privacy](08-SECURITY_AND_PRIVACY.md)
9. [Test and Quality Plan](09-TEST_AND_QUALITY_PLAN.md)
10. [Development and Operations Guide](10-DEVELOPMENT_AND_OPERATIONS_GUIDE.md)
11. [Roadmap and Acceptance Plan](11-ROADMAP_AND_ACCEPTANCE_PLAN.md)
12. [Requirements Traceability Matrix](12-REQUIREMENTS_TRACEABILITY_MATRIX.md)
13. [Stage 0 Implementation Report](13-STAGE-0-IMPLEMENTATION-REPORT.md)
14. [Stage 1 Implementation Report](14-STAGE-1-IMPLEMENTATION-REPORT.md)
15. [Stage 2 Implementation Report](15-STAGE-2-IMPLEMENTATION-REPORT.md)
16. [Stage 3 Implementation Report](16-STAGE-3-IMPLEMENTATION-REPORT.md)
17. [Stage 4 Implementation Report](17-STAGE-4-IMPLEMENTATION-REPORT.md)
18. [Stage 5 Implementation Report](18-STAGE-5-IMPLEMENTATION-REPORT.md)
19. [Stage 5.1 Implementation Report](19-STAGE-5.1-IMPLEMENTATION-REPORT.md)
20. [Stage 6 Implementation Report](20-STAGE-6-IMPLEMENTATION-REPORT.md)
21. [Stage 6.1 Implementation Report](21-STAGE-6.1-IMPLEMENTATION-REPORT.md)
22. [C++ API Reference Module Design](22-API-REFERENCE-MODULE-DESIGN.md)
23. [C++ API Reference Content Authoring Guide](23-API-REFERENCE-CONTENT-AUTHORING-GUIDE.md)
24. [C++ API Reference Implementation Plan](24-API-REFERENCE-IMPLEMENTATION-PLAN.md)
25. [Stage 6.2 Phase 1 Implementation Report](25-STAGE-6.2-PHASE-1-IMPLEMENTATION-REPORT.md)
26. [Domain Context](CONTEXT.md)

Core learner references:

- [Modern C++ Mental Model](reference/MODERN_CPP_MENTAL_MODEL.md)
- [Ownership and Lifetime](reference/OWNERSHIP_AND_LIFETIME.md)
- [Build, Test, and Debug](reference/BUILD_TEST_DEBUG.md)
- [Deterministic Algorithm Testing](reference/DETERMINISTIC_ALGORITHM_TESTING.md)
- [Local System Labs](reference/LOCAL_SYSTEM_LABS.md)
- [Production C++ Service Evidence](reference/PRODUCTION_CPP_SERVICE.md)

## Architecture decisions

- [ADR-0001: Web-first local single-user product](adr/0001-web-first-local-single-user.md)
- [ADR-0002: Shared learning core with multiple adapters](adr/0002-shared-learning-core.md)
- [ADR-0003: Event log with rebuildable SQLite projections](adr/0003-event-log-and-sqlite-projections.md)
- [ADR-0004: Native judge first, container adapter later](adr/0004-native-judge-first.md)
- [ADR-0005: Declarative curriculum content](adr/0005-declarative-curriculum-content.md)
- [ADR-0006: Separate declarative C++ API Reference Module](adr/0006-separate-declarative-api-reference.md)

## Archive

Documents under `archive/` record earlier exploration and are not normative:

- [Alternative project designs](archive/PROJECT_DESIGN_OPTIONS.md)
- [Initial Web architecture proposal](archive/WEB_PLATFORM_ARCHITECTURE.md)

If an archived statement conflicts with a current baseline document or accepted ADR, the current baseline and ADR take precedence.

## Document control

- Status values: `Draft`, `In Review`, `Baseline`, `Superseded`, `Archived`.
- Changes affecting scope or acceptance require an update to the SRS and traceability matrix.
- Hard-to-reverse architecture changes require an ADR.
- Interface changes require versioning and corresponding contract-test updates.
- Dates use `YYYY-MM-DD`; identifiers remain stable after publication.
