# Stage 6.2 Phase 2 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-011 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Scope delivered

- Added a lazy-loaded Web Reference route linked from the learning console.
- Added a three-column desktop browser with category navigation, main article,
  and local table of contents; narrow screens use a labeled directory drawer.
- Added URL-backed text search, category filtering, canonical Entry slugs,
  historical-slug replacement, stable heading anchors, and browser-history
  restoration.
- Added landing, results, Entry, loading, empty, not-found, degraded, and error
  views.
- Added semantic standard, deprecation, removal, and local-verification badges;
  source links; related Entries and Activities; complete examples; expected
  output; and accessible copy feedback.
- Added semantic, slug-resolved Activity-to-Reference links alongside the
  existing Reference-to-Activity path, preserving the unsaved-code guard.
- Expanded the release catalog from 5 to the specified 15-Entry editorial set
  and from 4 to 12 compiled examples across containers, algorithms, strings,
  memory, and utility topics; the catalog version is now 2.
- Added production SPA fallback for `/reference` and `/reference/*` without
  changing `/api` error behavior.

## 2. Architecture and state

The top-level Web Adapter selects the Reference route before mounting the
learning console. `ReferenceBrowser` and its Markdown dependency are loaded by
dynamic import, so opening the Dashboard does not fetch the Reference browser
chunk. Reference reads use only the versioned GET endpoints from Phase 1.

Entry slugs, search text, category filters, and heading anchors are represented
in the URL. Historical slugs use `history.replaceState`; user navigation uses
real links or `history.pushState` as appropriate. Browsing, copying, and source
inspection do not dispatch Learning Platform commands.

## 3. Acceptance evidence

| Test | Evidence | Result |
|---|---|---|
| `T-REF-004` | `npm run check:reference` compiles and executes 12 examples under their declared standards with strict warnings | Passed |
| `T-REF-006` | Playwright covers symbol/header/Chinese search, category URL reload, canonical redirects, anchors, history, keyboard navigation, bidirectional Activity links, and 390-pixel layout | Passed |
| `T-REF-007` | Playwright compares Workspace and Dashboard state before/after copy and observes no non-GET browser request | Passed |
| `T-REF-008` | `npm run test:e2e:production` serves the real Vite `dist` through Fastify and completes a deep-link browser flow while all non-loopback requests are actively blocked | Passed |
| Existing regression suite | `npm test`, `npm run test:e2e`, and `npm run check:content` retain Shared contracts, Curriculum, server, learning, Workspace, Judge, CLI, and Dashboard coverage | Passed |

## 4. Release content

The 15-Entry vertical release matches the Authoring Guide backlog: three
landings; the vector and algorithm headers; vector, string, string-view,
unique-pointer, and optional types; sort, find, and make-unique functions;
`vector::push_back`; and the sequence-container selection guide. Every
non-landing Entry has an original deterministic example and a primary
working-draft source.

## 5. Accessibility and responsive behavior

- Search has a programmatic label and keyboard submission.
- Results and navigation targets use semantic links; filters and copy actions
  use buttons.
- Focus indicators, skip navigation, heading anchors, live copy feedback, and
  non-color status text are present.
- The directory drawer is labeled and URL-backed filters survive reload.
- The 390-pixel browser test asserts no document-level horizontal overflow.
- Reduced-motion preferences disable the loading spinner.

## 6. Controlled limitations

- Phase 2 is a read-only browser. Reference Playground execution remains Phase
  4 and cannot create Attempts or Evidence.
- The release catalog contains 15 Entries; core expansion to 80–120 Entries is
  Phase 3.
- Local verification status remains `not-checked` until a runtime verification
  Adapter supplies local results.
- Fuzzy matching and remote search remain intentionally disabled.

## 7. Rollback

Revert the Web route, production fallback, Phase 2 content paths, and catalog
additions. The Phase 1 HTTP Module and existing learner data remain valid; no
Learning Record or Workspace migration is required.
