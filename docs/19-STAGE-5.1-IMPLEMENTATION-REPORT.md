# Stage 5.1 Implementation Report

| Field | Value |
|---|---|
| Document ID | IMP-007 |
| Version | 1.0 |
| Status | Accepted |
| Owner | Project Maintainer |
| Last updated | 2026-08-23 |

## 1. Scope delivered

- Replaced the narrow persistent sidebar with a responsive top-level product navigation and a clearer learning-session entry point.
- Added a complete Activity catalog with kind filters, counts, ordered numbering, loading states, and shareable query state.
- Made Activity Workspaces directly addressable through the `activity` URL parameter and kept browser history synchronized when opening or leaving training.
- Added previous/next Activity controls with Track position, titles, disabled boundary states, and unsaved-work confirmation.
- Rebuilt the desktop training surface as a bounded viewport: long Lesson content scrolls inside the left panel while the Monaco editor, file tabs, Run, Grade, Save, and Judge output stay available on the right.
- Added a narrow-screen single-column mode and constrained Monaco's minimum content width so the page does not create horizontal overflow.
- Added semantic landmarks, a skip link, live status regions, explicit labels, pressed/current states, and visible focus treatment.
- Added a local SVG favicon and product metadata without adding external runtime dependencies or network requests.

## 2. Training-page acceptance

| User need | Implementation | Verification |
|---|---|---|
| Read long Lesson content without losing the editor | `.lesson-panel` owns vertical scrolling inside a viewport-bounded desktop grid | At `1440 × 900`, setting Lesson scroll to `900` left `window.scrollY` at `0` and editor top at `162` before and after |
| Move through the Track without returning to the catalog | Ordered previous/next controls show adjacent Activity titles and the current Track position | Playwright moves first → second → first and verifies headings, URL state, and the disabled first boundary |
| Continue on a phone-sized viewport | Workspace collapses to one column and panels may size below Monaco's intrinsic width | At `390` pixels, document, Lesson, and editor widths remain within the viewport (`scrollWidth = innerWidth = 390`) |
| Protect in-progress edits | Leaving or changing Activity asks for confirmation when source differs from the saved Workspace | Component behavior and code review |

## 3. Broader Web experience

The overview preserves the local-first product character while making the 42-Activity Track easier to scan. Navigation links identify the active section, catalog filters update the URL, and Activity cards are native buttons rather than pointer-only containers. Learning records, environment status, reviews, and knowledge state remain on the same page and retain the existing server contracts.

The redesign changes presentation and client navigation only. Curriculum definitions, Learner Workspaces, immutable Source Snapshots, Judge semantics, Evidence policy, and persistence formats are unchanged.

## 4. Automated evidence

Reproduce all repository gates with:

```bash
npm run check
npm run test:e2e
```

The real-browser scenario verifies the catalog, direct Activity URL state, previous/next navigation, Workspace save, Run isolation, Reflection, Grade, Evidence, Review scheduling, and return to overview. Layout assertions verify independent desktop scrolling and narrow-screen overflow behavior. Unit, contract, content, type, lint, formatting, build, and documentation checks remain part of `npm run check`.

## 5. Review and limitations

- Stage 5.1 does not claim completion of the Stage 6 career track, additional portfolio Projects, cloud accounts, or an AI provider integration.
- Monaco remains intentionally lazy-loaded and produces a large optional editor chunk warning during the production build; the overview bundle remains separate.
- Automated accessibility coverage verifies critical semantics and keyboard-operable controls, but a complete screen-reader/browser matrix remains future release work.
- Native judging executes trusted local Learner code and is not a hostile-code sandbox.

## 6. Next controlled increment

Stage 6 adds deeper network, database, concurrency, performance, deployment, observability, load-testing, incident-response, and interview practice, supported by 4–5 progressive portfolio Projects.
