# C++ Learning Platform Context

The domain covers guided acquisition and verification of C++ software-engineering capability by one learner using local lessons, exercises, projects, automated judging, and AI-assisted teaching.

## Learning content

**Track**:
A coherent route toward a career outcome, containing ordered Modules and Projects.
_Avoid_: Course, path

**Module**:
A curriculum grouping that develops a related set of Concepts through Activities.
_Avoid_: Chapter, section

**Concept**:
A named unit of capability whose state is supported by learning Evidence.
_Avoid_: Topic, skill point

**Activity**:
A versioned assignable learning item with objectives, prerequisites, content, completion criteria, and an Evidence policy.
_Avoid_: Task, item

**Lesson**:
An Activity that introduces a narrowly scoped Concept and contains at least one retrieval or practice step.
_Avoid_: Article, page

**Exercise**:
An Activity in which the Learner produces or diagnoses an executable or reviewable artifact.
_Avoid_: Question, problem

**Review**:
An Activity scheduled after earlier exposure to test delayed retrieval or transfer.
_Avoid_: Revision, repeat

**Project**:
A persistent artifact developed through multiple Milestones to integrate Concepts in a realistic engineering context.
_Avoid_: Large exercise, demo

**Milestone**:
A versioned, independently verifiable increment of a Project.
_Avoid_: Phase, subtask

## Learning state

**Learner**:
The single local person whose work, assistance usage, Evidence, and progress are recorded.
_Avoid_: User, student account

**Attempt**:
One bounded interaction with an Activity, including its source snapshot, assistance history, and result.
_Avoid_: Submission, run

**Run**:
A fast execution for experimentation that never changes Concept state.
_Avoid_: Submission

**Grade**:
A complete Judge evaluation of an immutable source snapshot that may produce Evidence.
_Avoid_: Run, score

**Evidence**:
A versioned observation supporting or challenging a Concept state, including independence, difficulty, source, and time.
_Avoid_: Point, mark

**Concept State**:
One of `unseen`, `introduced`, `practiced`, `demonstrated`, or `retained`, derived from Evidence rather than manually assigned.
_Avoid_: Score, level

**Teacher Observation**:
A structured qualitative assessment proposed by an AI or human teacher and evaluated by the learning rules before becoming Evidence.
_Avoid_: AI score, manual grade

**Learning Record**:
A human-readable note containing a durable insight, prior capability, corrected misconception, or mission change.
_Avoid_: Activity log, progress event

## Reference content

**Reference Entry**:
A versioned, addressable C++ lookup document owned by the Reference Module. It
may describe a header, type, object, function, member, concept, guide, or
landing area, but is not an Activity and produces no Evidence.
_Avoid_: Lesson, documentation Activity, copied cppreference page

**Reference Example**:
An original deterministic source file attached to a Reference Entry and
verified under a declared C++ standard.
_Avoid_: Reference solution, hidden test, learner submission

**Playground**:
A temporary non-Activity code area for experimenting with a Reference Example.
It may use the Judge execution seam but has no Attempt or Evidence policy.
_Avoid_: Workspace, sandbox, Exercise

**Authoring Draft**:
A versioned, non-canonical working set used to prepare one Reference Entry. It
may contain incomplete candidate content and cannot be served to the Learner or
published without later checks.
_Avoid_: Reference Entry, unpublished page, CMS record

**Fact Sheet**:
The structured claim groups for an Authoring Draft, including verification
state and links to Source Ledger records.
_Avoid_: generated article, copied source notes

**Source Ledger**:
The versioned source records used to verify Fact Sheet claim groups. A ledger
records provenance but does not authorize copying source prose.
_Avoid_: bibliography only, mirrored source page

**Authoring Report**:
A revision-bound, machine-readable result for one Authoring Draft. `blocked`
contains actionable findings; `ready` authorizes later human review but is not
itself canonical publication.
_Avoid_: Judge Report, build log, published Entry

**Publication Plan**:
The exact create/update/delete digest set for promoting one checked Authoring Draft at
one revision. A dry-run plan is review evidence, not a Git commit or release.
_Avoid_: patch guess, deployment, automatic publication

**Authoring Cache Record**:
A disposable compiler-result record addressed by every execution-relevant
input. It may shorten an inner loop but cannot replace the full release gate.
_Avoid_: build artifact, source of truth, readiness approval

**Authoring Context Pack**:
A deterministic, digest-bound allowlist of explicitly selected verified Fact
Sheet groups and their Source Ledger evidence for a later AI Adapter. It does
not contain unverified facts and does not make generated prose authoritative.
_Avoid_: prompt dump, scraped corpus, AI truth source

**Authoring Generation**:
A schema-validated AI proposal for one controlled part of an Authoring Draft.
It names the exact context-pack digest and maps each generated claim to allowed
Fact Sheet groups; it is input to review, not accepted Reference content.
_Avoid_: AI answer, generated page, publication candidate

**Generated Summary**:
A bounded single-line Authoring Generation for the candidate Reference Entry
summary. It shares section-generation provenance and review rules but never
changes article Markdown.
_Avoid_: page introduction, generated section, search keyword list

**Generation Receipt**:
A revision-bound draft artifact recording the accepted Authoring Generation,
its claim review, context digest, and application time. It supports audit and
reproduction but does not prove semantic correctness.
_Avoid_: approval, source evidence, release record

**Authoring Batch Report**:
A digest-bound measurement of one to five Authoring Drafts, including readiness,
examples, cache behavior, findings, time observations, and escaped corrections.
_Avoid_: synthetic productivity claim, release approval, author score

## Platform operations

**Workspace**:
The Learner-owned editable files for one Activity or Project, kept separate from curriculum content and private judge material.
_Avoid_: Sandbox, solution directory

**Source Snapshot**:
An immutable, content-addressed capture of Workspace files used by a Run or Grade.
_Avoid_: Backup, submission

**Judge**:
The Module that evaluates a Source Snapshot and emits structured Judge Events and a Judge Report.
_Avoid_: Compiler, test script

**Judge Report**:
The immutable categorized outcome of a Grade, including toolchain identity and stage results.
_Avoid_: Score, console output

**Hint**:
A recorded, ordered disclosure that reduces Attempt independence and never exposes private judge inputs verbatim.
_Avoid_: Answer, solution
