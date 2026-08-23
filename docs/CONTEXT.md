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

