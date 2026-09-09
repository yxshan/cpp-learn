# External Architecture Benchmarks

| Field | Value |
|---|---|
| Document ID | ARCH-BENCH-001 |
| Version | 1.0 |
| Status | In Review |
| Owner | Project Maintainer |
| Prepared by | GPT-5.6 Sol |
| Last updated | 2026-09-09 |

## 1. Scope and method

This note compares the C++ Learning Platform with mature documentation and
programming-learning systems. It uses first-party repositories and official
project documentation rather than third-party architecture summaries. The goal
is to extract transferable module, content, validation, and execution patterns;
it is not to copy another project's deployment shape.

## 2. MDN Web Docs

MDN explicitly separates its English source content from the machinery and UI
that publish it. The official repository guide identifies `mdn/content` as the
home of prose and in-page examples, `mdn/rari` as the backend responsible for
page structure, templating, and rendering, `mdn/fred` as the frontend, and
`mdn/browser-compat-data` as structured compatibility data.[^mdn-repositories]
The content repository contains more than 14,000 pages and remains independently
reviewable as source content.[^mdn-content]

The older Yari platform description documents a useful build shape even though
MDN's current repository map has evolved: source documents contain metadata and
Markdown/HTML; a builder produces complete HTML plus JSON consumed by the
frontend; flaw checks can be evaluated across the whole collection before
publication.[^mdn-yari]

Transferable lessons:

- Keep Reference Entry source independent from the Web implementation.
- Treat rendering as its own reusable module rather than making the CLI depend
  on a browser application package.
- Keep factual structured data separate from explanatory prose where the data
  has different validation and reuse rules.
- Make collection-wide flaw detection a build concern, while keeping a fast
  changed-entry author loop.

Do not copy:

- MDN's multi-repository and localization scale is unnecessary for one local
  Learner.
- Browser compatibility data has a different truth model from C++ standard
  wording; it is an analogy for structured facts, not a source for this project.

## 3. Docusaurus

Docusaurus organizes documentation in four nested levels: pages, sidebars,
versions, and plugin instances.[^docusaurus-introduction] Its docs plugin owns
content paths, inclusion/exclusion rules, metadata, draft state, versions,
sidebars, and page roots as one coherent plugin interface.[^docusaurus-plugin]
Its versioning tool snapshots the current docs tree into a named version rather
than encoding delivery history into every filename.[^docusaurus-versioning]

Transferable lessons:

- Separate stable baseline documentation from delivery reports and research
  evidence.
- Use indexes and categories as navigation; do not require readers to traverse a
  single 60-plus-file chronological list.
- Preserve stable document IDs and links even if physical folders change.
- Keep one current baseline and archive historical delivery evidence by stage.

Do not copy:

- This project does not need a general documentation plugin system or multiple
  published documentation versions yet.
- MDX execution would conflict with the accepted declarative-content decision.

## 4. Exercism

Exercism keeps each language Track declarative and colocates exercise-specific
documentation, metadata, tests, starter code, and exemplar code under the
exercise directory.[^exercism-practice] The official C++ Track follows that
shape and validates exercises using CMake plus repository tooling.[^exercism-cpp]
Canonical exercise data is maintained separately and synchronized into Tracks
through explicit UUID-based selections and the `configlet` maintenance
tool.[^exercism-problem-specifications]

Production tooling is also separated by responsibility. Exercism describes the
website as the orchestrator and each language Test Runner as an independently
packaged implementation with a defined interface.[^exercism-test-runners]
`configlet` provides deterministic checks and canonical formatting for the many
metadata files in a Track.[^exercism-configlet]

Transferable lessons:

- Continue colocating an Activity's manifest, lesson content, starters, and
  public exercise assets under one Activity identity.
- Keep Judge execution behind a language/toolchain seam; the Web Adapter should
  orchestrate rather than know compiler details.
- Grow maintenance tooling around schemas, synchronization, formatting, and
  validation instead of adding manual author steps.
- Make generated or synchronized content choices explicit and reviewable rather
  than silently inheriting upstream changes.

Do not copy:

- Per-language remote repositories and Docker deployment are excessive while
  the platform remains local, C++-only, and single-user.
- Exercism's hosted mentor and submission model should not pull Reference
  Entries into the Learning Record or Evidence model.

## 5. Judge0 and isolated execution systems

Judge0 exposes code execution through an HTTP JSON interface and supports a
worker-oriented scalable deployment.[^judge0-readme] Its configuration separates
worker concurrency and queue limits from submission resource and isolation
settings, and it uses `isolate` as the sandboxing implementation.[^judge0-config]

Transferable lessons:

- Preserve the Judge seam so native execution can later gain a container or
  remote adapter.
- Keep admission/concurrency, immutable execution input, result reporting, and
  execution isolation as different responsibilities inside the Judge module.
- Continue to describe native local execution accurately rather than claiming
  it is a strong sandbox.

Do not copy:

- Redis/PostgreSQL worker infrastructure and public multi-tenant execution are
  not justified by the accepted local single-user product decision.
- Arbitrary compiler options and language runtimes would weaken the platform's
  fixed-capability curriculum and Reference Example contracts.

## 6. C++ reference sources

The official C++ draft repository separates normative document source from
supporting tools and provides both source-level and rendered-output checks.[^cpp-draft]
cppreference provides offline HTML and raw wiki archives, but describes the raw
archive as upstream source material for rebuilding its own publication rather
than as a reusable data contract.[^cppreference-archives]

Transferable lessons:

- Keep the Working Draft and primary library specifications as fact evidence,
  while retaining original explanatory prose.
- Preserve both source/content checks and rendered-output checks.
- Do not design the platform around importing cppreference's page storage
  format; use it as a presentation and coverage reference only.

## 7. Resulting architecture constraints

The comparison supports the project's existing ADRs: declarative Curriculum,
separate Reference content, a shared Learning Platform, and a native-first Judge
are sound. It also supports four refinements:

1. Create one source of truth for Reference profiles, quality areas, headings,
   required facts, and repair targeting.
2. Move shared Reference rendering out of the Web application package.
3. Keep the Author Console as a thin review adapter over the existing Authoring
   module rather than creating a second authoring implementation.
4. Reorganize project documentation into stable baseline, decisions, delivery
   reports, and research collections while preserving stable links.

[^mdn-repositories]: [MDN: GitHub repositories](https://github.com/mdn/content/blob/main/files/en-us/mdn/community/our_repositories/index.md)
[^mdn-content]: [mdn/content](https://github.com/mdn/content)
[^mdn-yari]: [mdn/yari: How it works](https://github.com/mdn/yari#how-it-works)
[^docusaurus-introduction]: [Docusaurus: Docs introduction](https://docusaurus.io/docs/docs-introduction)
[^docusaurus-plugin]: [Docusaurus docs plugin declaration](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/plugin-content-docs.d.ts)
[^docusaurus-versioning]: [Docusaurus: Versioning](https://docusaurus.io/docs/versioning)
[^exercism-practice]: [Exercism: Practice Exercises](https://exercism.org/docs/building/tracks/practice-exercises)
[^exercism-cpp]: [Exercism C++ Track](https://github.com/exercism/cpp)
[^exercism-problem-specifications]: [Exercism problem specifications](https://github.com/exercism/problem-specifications)
[^exercism-test-runners]: [Exercism: Test Runners](https://exercism.org/docs/building/tooling/test-runners)
[^exercism-configlet]: [Exercism configlet](https://github.com/exercism/configlet)
[^judge0-readme]: [Judge0](https://github.com/judge0/judge0)
[^judge0-config]: [Judge0 configuration](https://github.com/judge0/judge0/blob/master/judge0.conf)
[^cpp-draft]: [C++ Standard Draft Sources](https://github.com/cplusplus/draft)
[^cppreference-archives]: [cppreference offline archives](https://en.cppreference.com/w/Cppreference:Archives)

本架构对照由 **GPT-5.6 Sol** 调研与整理。
