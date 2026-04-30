# Conductor Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `skills/conductor` skill that orchestrates multi-task roadmap execution by dispatching AUTO-mode brainstorming agents in sequence, acting as user-proxy at AUTO's existing gates, and managing per-task git-flow ceremonies (branch, PR review, integration merge) into a single human-reviewed final PR.

**Architecture:** Markdown-only skill following hey-d conventions. `SKILL.md` is the entry-point; `conducting-flow.md` owns the orchestration checklist. Four short reference files (`state-schema.md`, `roadmap-format.md`, `answer-authority.md`, `resume-procedure.md`) document data shapes and supporting heuristics. Examples directory provides copy-paste templates. State splits into durable artifacts on a `conductor/<roadmap-id>` integration branch (committed in a dedicated worktree) and an ephemeral `state.json` (gitignored). One `.gitignore` modification adds the state-directory exclusion.

**Tech Stack:** Markdown for all skill content. `gh` CLI for branch/PR/merge ops. `git worktree` for the conductor's dedicated state-writing worktree. Conventional Commits via the project's existing `feat(<scope>):` / `docs(<scope>):` patterns. No runtime code, no automated test framework — verification is structural grep checks per task plus a manual end-to-end procedure.

**Spec:** [docs/specs/2026-04-30-conductor-design.md](../specs/2026-04-30-conductor-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `skills/conductor/SKILL.md` | Create | Entry point: YAML frontmatter (name + description for skill discovery), brief overview, mode detection (none for v1), prerequisites, pointer to `conducting-flow.md`. |
| `skills/conductor/state-schema.md` | Create | `state.json` field reference + exhaustive `phase` enum + per-phase resume actions. Authoritative state shape. |
| `skills/conductor/roadmap-format.md` | Create | `roadmap.md`, `roadmap-meta.md`, `task-<N>/summary.md` schemas with examples. Authoritative durable-state shapes. |
| `skills/conductor/answer-authority.md` | Create | The grounding heuristic for "answer or halt at AUTO's gate" — when conductor speaks vs. surfaces to human. |
| `skills/conductor/resume-procedure.md` | Create | Step-by-step resume flow with a `switch (phase)` dispatch and the resume / restart / abort decision tree. |
| `skills/conductor/conducting-flow.md` | Create | The main orchestration checklist. Long-form: init → per-task loop (branch + dispatch AUTO + handle gates + review-fix loop + merge + summary) → end-of-roadmap → cleanup. References all of the above. |
| `skills/conductor/examples/roadmap.md` | Create | Copy-paste template for users authoring a roadmap. |
| `skills/conductor/examples/roadmap-meta.md` | Create | Copy-paste template. |
| `skills/conductor/examples/task-summary.md` | Create | Copy-paste template for the AUTO-completed-task summary shape. |
| `skills/conductor/examples/state.json` | Create | Concrete `state.json` example showing every field populated. |
| `skills/conductor/manual-test.md` | Create | Step-by-step manual end-to-end procedure: stand up a 2-task throwaway roadmap on a scratch branch and validate the full lifecycle. |
| `.gitignore` | Modify | Add `docs/roadmaps/*/state/` line so per-machine ephemeral state is never committed. |

**Task order rationale:** Define data shapes first (state-schema, roadmap-format) so that downstream files can reference exact field names. Then write decision-rule references (answer-authority, resume-procedure) since the main flow consumes them. Then write the main flow (conducting-flow) which composes everything. Then add examples and the gitignore. Finally, write the manual e2e procedure that exercises the whole thing.

---

## Task 1: Scaffold `skills/conductor/SKILL.md`

**Files:**
- Create: `skills/conductor/SKILL.md`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p skills/conductor/examples
```

- [ ] **Step 2: Write `skills/conductor/SKILL.md`**

```markdown
---
name: conductor
description: Use when you have a multi-task roadmap to execute autonomously — conductor dispatches AUTO-mode brainstorming agents per task, acts as user-proxy at AUTO's gates, manages a per-roadmap integration branch via a dedicated worktree, and runs per-task review-fix-merge loops. Halts to human only on contract violations, unanswerable questions, or repeated failures. Final PR to main is always human-reviewed and human-merged. v1 is sequential, GitHub-only.
---

# Conductor — Multi-Task Roadmap Orchestration

## Overview

Conductor walks a roadmap (`docs/roadmaps/<roadmap-id>/roadmap.md`) and runs each task end-to-end via AUTO-mode brainstorming. It does NOT make product decisions, write code, or design specs — those are AUTO's job. Conductor's job is:

1. Pick the next task with dependencies satisfied.
2. Set up the per-task feat branch (off the per-roadmap integration branch).
3. Dispatch AUTO with a strict branch-and-PR contract; record the sub-agent ID.
4. When AUTO returns at a blocking gate, **answer it from artifacts** if grounded, else halt to human.
5. After AUTO returns success, run a review-fix loop (max 3 rounds) against the per-task PR.
6. Merge the per-task PR (no squash) into the integration branch.
7. Write `task-<N>/summary.md` and update `roadmap.md` status.
8. Repeat until no eligible tasks remain, then open ONE final PR `conductor/<roadmap-id>` → main for the human to review and merge.

**Announce at start:** "I'm using the conductor skill to orchestrate roadmap `<roadmap-id>`."

## Prerequisites

These MUST hold before conductor runs. Verify each at session start; halt with a clear error if any fails.

- **Roadmap file exists.** `docs/roadmaps/<roadmap-id>/roadmap.md` is present, readable, and contains at least one task. Format: see `roadmap-format.md`.
- **`roadmap-meta.md` exists** in the same directory and declares the integration branch's base (defaults to `main`). Format: see `roadmap-format.md`.
- **`gh` CLI is authenticated** against the repo's GitHub remote. Run `gh auth status` and `gh repo view --json name,owner` — both must succeed. Conductor cannot function without GitHub.
- **Working tree is clean** at session start. Run `git status --porcelain`; abort if non-empty (the user has uncommitted work).
- **No conflicting worktree.** If `<repo>/.worktrees/conductor-<roadmap-id>/` already exists, ask the user before overwriting (they may be resuming).

## Composed skills

Conductor invokes these existing skills via dispatched sub-agents — never re-implements:

- `hey-d:brainstorming` (AUTO mode) — every per-task implementation cycle
- `hey-d:requesting-code-review` — the review sub-agent for each per-task PR
- `hey-d:receiving-code-review` — invoked by AUTO when it receives must-fix feedback
- `hey-d:verification-before-completion` — already part of AUTO's Checkpoint 3.5
- `hey-d:using-git-worktrees` — used by conductor at init to create the dedicated state-writing worktree

## Mode detection

v1 has a single mode. Future versions may add `resume`, `dry-run`, etc.

| Trigger | Behavior |
|---|---|
| `conductor <roadmap-id>` (or just `<roadmap-id>` if context is clear) | Run the full orchestration loop on `docs/roadmaps/<roadmap-id>/`. Follow `conducting-flow.md`. |
| `conductor resume <roadmap-id>` | Resume an in-flight roadmap. Follow `resume-procedure.md`. |

If neither matches, ask the user for the roadmap-id.

## Authoritative checklist

Once prerequisites pass and a mode is chosen, the rest of the session is governed by:

- **`conducting-flow.md`** — the per-task and roadmap-level orchestration loop
- **`resume-procedure.md`** — when resuming an in-flight roadmap
- **`state-schema.md`** — the `state.json` shape and `phase` enum
- **`roadmap-format.md`** — the durable artifact shapes
- **`answer-authority.md`** — when to answer AUTO's gate vs. halt to human

Read the relevant flow file in full before taking any action.

## Hard gate

Conductor never auto-merges to `main`. The final PR `conductor/<roadmap-id>` → main is always opened by conductor and merged by a human. Conductor reports the PR URL and exits.
```

- [ ] **Step 3: Verify the file structure**

Run: `cat skills/conductor/SKILL.md | head -5`
Expected output:
```
---
name: conductor
description: Use when you have a multi-task roadmap...
---
```

Run: `grep -c '^## ' skills/conductor/SKILL.md`
Expected: `5` (Overview, Prerequisites, Composed skills, Mode detection, Authoritative checklist; "Hard gate" is `## ` too — actually 6).

If the count differs, inspect and fix.

- [ ] **Step 4: Commit**

```bash
git add skills/conductor/SKILL.md
git commit -m "feat(conductor): scaffold SKILL.md entry point"
```

---

## Task 2: Write `state-schema.md`

**Files:**
- Create: `skills/conductor/state-schema.md`

This file is the single source of truth for `state.json`. The `phase` enum is load-bearing: every other reference + `conducting-flow.md` reads from it.

- [ ] **Step 1: Create `skills/conductor/state-schema.md`**

````markdown
# State Schema

The conductor's ephemeral runtime state lives in a single JSON file:

```
docs/roadmaps/<roadmap-id>/state/state.json
```

This directory is **gitignored** (see `.gitignore`'s `docs/roadmaps/*/state/` line) and lives only in the conductor's own worktree — never in the main working tree. Crash recovery reads this file on resume.

## Field reference

| Field | Type | Required | Purpose |
|---|---|---|---|
| `roadmapId` | string | yes | The roadmap-id this state belongs to. Sanity check on resume. |
| `currentTaskId` | number | yes | Which task in `roadmap.md` is active. |
| `currentBranch` | string \| null | yes | Per-task feat branch checked out on the main tree (e.g., `feat/2-token-storage`). Null only between tasks. |
| `subAgentId` | string \| null | yes | The dispatched AUTO agent's ID, used for SendMessage continuation. Null when no AUTO is running. |
| `dispatchedAt` | ISO-8601 string \| null | yes | When the current AUTO dispatch went out. Used to detect stuck agents. |
| `autoReturnedAt` | ISO-8601 string \| null | yes | When AUTO last returned (success or gate question). Null while AUTO is running. |
| `phase` | enum (see below) | yes | The state machine's current position. **Resume's first action is `switch (phase)`.** |
| `lastHaltAt` | ISO-8601 string \| null | yes | When conductor last halted to a human. Null in non-halted phases. |
| `lastHaltQuestion` | string \| null | yes | The question or failure text that triggered the halt. Surfaced verbatim on resume. |
| `fixLoopRound` | number | yes | Review-fix iteration count, 0 to 3. |
| `currentReviewId` | string \| null | yes | Dispatched review agent's ID. Used to know whether feedback for this round was already sent. |
| `prNumber` | number \| null | yes | The per-task PR number (from `gh pr create`). Null until AUTO opens the PR. |
| `prUrl` | string \| null | yes | Convenience for human-facing reporting. Mirrors `prNumber`. |

All required fields MUST be present (with `null` where the value is not yet known). Missing keys = corrupted state, treat as needing human intervention.

## `phase` enum (exhaustive)

| Phase | Meaning | Resume action |
|---|---|---|
| `dispatching` | Conductor is mid-flight in branch-create + AUTO dispatch. Crash here means the feat branch may or may not exist. | Re-do branch setup if missing; re-dispatch AUTO. |
| `auto-running` | AUTO has been dispatched and has not yet returned. | Try `SendMessage subAgentId` with an empty nudge; if it fails, re-dispatch with continuation note (see `conducting-flow.md` § Re-dispatch). |
| `auto-blocked-on-gate` | AUTO returned with a gate question; conductor halted to human. | Wait for human answer; on resume, SendMessage the answer. If sub-agent dead, re-dispatch with continuation note that includes `lastHaltQuestion`. |
| `awaiting-review` | AUTO returned success and PR is open; review agent not yet dispatched. | Dispatch the review agent against `prNumber`. |
| `review-running` | Review agent has been dispatched. | Try `SendMessage currentReviewId`; if dead, re-dispatch review on the same PR. |
| `review-feedback-sent` | Review returned must-fixes; SendMessage'd to AUTO; awaiting AUTO's push. | Try `SendMessage subAgentId` to nudge; if dead, re-dispatch AUTO with feedback context. |
| `awaiting-merge` | Review clean + CI green; conductor about to call `gh pr merge`. | Verify PR still mergeable (`gh pr view --json mergeable,mergeStateStatus`), then merge. |
| `summary-writing` | Merged successfully; writing `task-N/summary.md` and updating `roadmap.md`. | Verify the summary file (idempotent); finish the commit + push if not done. |
| `task-halted` | Round counter exceeded, AUTO failed, or conductor couldn't answer a gate. | Surface `lastHaltAt` + `lastHaltQuestion` to human; await `resume` / `restart` / `abort`. |
| `done` | This task is complete; conductor about to move to next. | Pick next task with deps satisfied; reset state to `dispatching`. |

## Phase transitions

```
dispatching → auto-running
auto-running → auto-blocked-on-gate (AUTO returned a gate question)
auto-running → awaiting-review (AUTO returned success with PR open)
auto-running → task-halted (AUTO returned failure or contract violation)
auto-blocked-on-gate → auto-running (conductor SendMessages an answer)
auto-blocked-on-gate → task-halted (conductor cannot answer)
awaiting-review → review-running
review-running → review-feedback-sent (must-fixes returned)
review-running → awaiting-merge (clean review + green CI)
review-feedback-sent → review-running (AUTO pushed; loop back) — increments fixLoopRound
review-feedback-sent → task-halted (fixLoopRound > 3)
awaiting-merge → summary-writing
awaiting-merge → task-halted (gh pr merge failed)
summary-writing → done
done → dispatching (next task)
```

Any transition NOT in this list is a bug. The orchestrator MUST log the attempted transition and halt rather than executing it.

## Atomic write rule

`state.json` writes use the temp-file-and-rename pattern to survive a crash mid-write:

```bash
TMP=$(mktemp "$STATE_PATH.XXXXXX")
echo "$NEW_JSON" > "$TMP"
mv "$TMP" "$STATE_PATH"
```

Never write directly to `state.json`. A crash mid-`echo` would leave the file unparseable.
````

- [ ] **Step 2: Verify all 13 fields are documented**

Run: `grep -c '^| \`' skills/conductor/state-schema.md`
Expected: at least `13` (one row per field).

- [ ] **Step 3: Verify all 10 phases are documented**

Run: `grep -E '^\| \`(dispatching|auto-running|auto-blocked-on-gate|awaiting-review|review-running|review-feedback-sent|awaiting-merge|summary-writing|task-halted|done)\`' skills/conductor/state-schema.md | wc -l`
Expected: `10`.

- [ ] **Step 4: Commit**

```bash
git add skills/conductor/state-schema.md
git commit -m "docs(conductor): add state.json schema and phase enum reference"
```

---

## Task 3: Write `roadmap-format.md`

**Files:**
- Create: `skills/conductor/roadmap-format.md`

Defines the durable-state file shapes: `roadmap.md`, `roadmap-meta.md`, `task-<N>/summary.md`. These are committed on the integration branch and represent the project history of the roadmap.

- [ ] **Step 1: Create `skills/conductor/roadmap-format.md`**

````markdown
# Roadmap & Task Artifact Formats

This file is the source of truth for the durable-state files committed to `conductor/<roadmap-id>`. Conductor parses these files at runtime and writes them at task boundaries.

## `roadmap.md`

Plain markdown with a fenced YAML block listing tasks. The YAML is parsed by the orchestrator; the surrounding markdown is for the human reader.

### Required structure

````markdown
# Roadmap: <human-readable name>

<one-paragraph description of the roadmap's overall goal>

## Tasks

```yaml
tasks:
  - id: 1
    title: "Add JWT verification middleware"
    deps: []
    status: pending     # pending | in-progress | done | halted | failed
  - id: 2
    title: "Migrate session store to Redis"
    deps: [1]
    status: pending
  - id: 3
    title: "Wire feature flag for staged rollout"
    deps: [1, 2]
    status: pending
```
````

### Field rules

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | number | yes | Strictly increasing from 1. No gaps. |
| `title` | string | yes | One-line description used as the dispatch prompt's task description. |
| `deps` | number[] | yes | List of `id`s that must be `done` before this task is eligible. May be empty. |
| `status` | enum | yes | `pending` initially, transitions per phase machine in `state-schema.md`. |

### Status transitions

`pending` → `in-progress` (conductor commits this when starting the task)
`in-progress` → `done` (conductor commits when summary is written)
`in-progress` → `halted` (conductor commits on un-recoverable halt)
`halted` → `in-progress` (on resume + retry)
`pending` → `failed` (only via explicit user action; conductor never sets this directly)

**Anti-pattern:** never write a status the orchestrator does not recognise. `done!` ≠ `done`.

## `roadmap-meta.md`

Markdown file with a single YAML frontmatter block. No body content required (a one-line description above the frontmatter is allowed).

### Required structure

```markdown
---
roadmapId: auth-rewrite
baseBranch: main
createdAt: 2026-04-30T10:00:00Z
owner: dev@zapass.co
integrationBranch: conductor/auth-rewrite
---
```

### Field rules

| Field | Type | Required | Notes |
|---|---|---|---|
| `roadmapId` | string | yes | Must match the directory name `docs/roadmaps/<roadmapId>/`. Sanity-checked on init. |
| `baseBranch` | string | yes | Branch to fork the integration branch from. Defaults to `main` if absent, but should be set explicitly. |
| `createdAt` | ISO-8601 string | yes | Timestamp of init. Set once; never updated. |
| `owner` | string | no | Email or username for human-facing reporting. |
| `integrationBranch` | string | yes | The branch name conductor creates. Convention: `conductor/<roadmapId>`. |

`roadmap-meta.md` is written ONCE at init and amended only on explicit user action.

## `task-<N>/summary.md`

Written ONCE per task by conductor when AUTO returns success and the per-task PR has been merged into the integration branch. The strict shape ensures future tasks reading prior summaries find the same categories every time.

### Required structure

````markdown
# Task <N>: <title from roadmap.md>

**Branch:** `feat/<N>-<keys>`
**PR:** #<prNumber> (merged at <ISO-8601>)
**AUTO spec:** `docs/specs/<spec-filename>.md`
**AUTO plan:** `docs/plans/<plan-filename>.md`

## Built

<bullet list — each bullet names a concrete artefact: a function, a file, an endpoint, a config change. Past-tense.>

- Added `verifyJwt` middleware in `src/auth/middleware.ts`
- Wired middleware into the request pipeline in `src/server.ts:42`
- Defined `JwtPayload` type in `src/auth/types.ts`

## Decided

<bullet list — design or product decisions made during the task. Each line: **what** and **why** in one sentence.>

- Used HS256 instead of RS256 because we don't yet have a key-rotation pipeline.
- Token TTL set to 15min; refresh-token flow deferred to task 3.

## Touched

<file list — every path AUTO committed. Read from `git diff --name-only`.>

- `src/auth/middleware.ts` (new)
- `src/auth/types.ts` (new)
- `src/server.ts` (modified)
- `tests/auth/middleware.test.ts` (new)

## Gotchas

<bullet list — anything a future task reader needs to know to avoid breaking this task's work. Empty section is allowed if there really are none — write "None.">

- The middleware mutates `req.user`; downstream handlers MUST treat it as set.
- HS256 secret is read from `process.env.JWT_SECRET`; tests need that env var.
````

### Field rules

- The four section headings (`## Built`, `## Decided`, `## Touched`, `## Gotchas`) are MANDATORY and case-sensitive. Conductor reads them by exact match when assembling context for downstream tasks.
- Each section may be empty (write `None.`) but the heading must still be present.
- The leading metadata block (Branch / PR / AUTO spec / AUTO plan) is mandatory; without it conductor can't reconstruct the task's git context on a future read.

## How conductor reads these files

- `roadmap.md` — parsed at task selection (find next `pending` task with all `deps` `done`).
- `roadmap-meta.md` — parsed once at session start; cached.
- `task-<N>/summary.md` — parsed when assembling the dispatch prompt for a task whose `deps` include `N`. Conductor passes the relevant summaries to AUTO so it has prior-task context.

## Examples

See `examples/roadmap.md`, `examples/roadmap-meta.md`, `examples/task-summary.md` for copy-paste templates.
````

- [ ] **Step 2: Verify mandatory section headings are documented**

Run: `grep -E '^### Required structure' skills/conductor/roadmap-format.md | wc -l`
Expected: `3` (one per artifact: roadmap, meta, summary).

Run: `grep -E '^- The four section headings' skills/conductor/roadmap-format.md`
Expected: matches the line about Built/Decided/Touched/Gotchas being mandatory.

- [ ] **Step 3: Commit**

```bash
git add skills/conductor/roadmap-format.md
git commit -m "docs(conductor): add roadmap and task-summary format reference"
```

---

## Task 4: Write `answer-authority.md`

**Files:**
- Create: `skills/conductor/answer-authority.md`

Codifies the heuristic for "when does conductor speak vs halt to human." This is the load-bearing rule that prevents conductor from hallucinating product decisions.

- [ ] **Step 1: Create `skills/conductor/answer-authority.md`**

````markdown
# Answer Authority

When AUTO returns at a blocking gate (Step 2 clarifying question, Gate A spec preview, or Gate B proceed-to-code preview), conductor must decide: **answer the gate from artifacts, or halt to human?**

This file codifies the heuristic. The bar is intentionally high — getting this wrong wastes tokens, ships wrong code, or worse, silently encodes a product decision conductor was never authorised to make.

## The rule

> **Answer ONLY if every part of the answer is grounded in concrete artifacts the conductor can read.**
>
> Allowed grounding sources:
>
> 1. `roadmap.md` — task description, dependency graph, status.
> 2. `roadmap-meta.md` — base branch, integration branch name, owner.
> 3. Prior `task-<N>/summary.md` files — what previous tasks built, decided, touched, and flagged.
> 4. The visible repo state at the conductor's worktree HEAD — `git log`, file contents, package.json, existing tests, etc.
>
> If the answer requires anything beyond these sources — a product preference, a domain assumption, a "we usually do X here" instinct, a guess about user intent — **halt**.

Halt is not failure. It is the cheap, correct outcome whenever the question outruns the available grounding.

## Categories of gate question

### Category A — Almost always answerable

These map directly onto artifacts. Conductor SHOULD answer.

- "Is this spec aligned with the task description?" — read `roadmap.md` task title + the dispatched prompt; compare with the spec preview. Answer `approve` if aligned, `edit <specific change>` otherwise.
- "Does this plan touch only the expected files?" — compare plan's expected-files list to the task description's scope. Answer or specify the edit.
- "Should I depend on the convention used in `<file mentioned in spec>`?" — read the file. Yes if it exists and the convention is clear; halt if ambiguous.

### Category B — Sometimes answerable, with care

These can be grounded, but the grounding must be explicit. Conductor MUST cite the source in its SendMessage answer ("per task-2/summary.md gotchas, X is required") so it's auditable.

- "Should I add error handling for case X?" — answerable IF a prior task summary's gotchas mention X, OR an existing helper in the codebase shows the convention. Otherwise halt.
- "Is this dependency already in the project, or do I need to add it?" — answerable from `package.json` / lockfile. Answer with the cited source.
- "Should the migration be reversible?" — answerable IF `roadmap-meta.md` or a prior summary specifies. Otherwise halt.

### Category C — Almost always halt

These are product or design decisions outside conductor's authority.

- Anything starting with "should we…" that has no answer in the artifacts.
- "Which library should I use for X?" — this is a design call, even if the technical considerations are visible. Halt.
- "What should the user-facing copy say?" — UX content; halt.
- "Is this acceptable performance?" — quantitative judgment; halt.
- Schema migrations that touch shared tables — halt regardless of grounding (blast radius too high).

## The halt protocol

When halting:

1. Update `state.json`: set `phase = auto-blocked-on-gate`, set `lastHaltAt` to now, set `lastHaltQuestion` to the verbatim AUTO question.
2. Surface to the user a single message:

   > Conductor halted at task `<N>` (phase: `auto-blocked-on-gate`).
   >
   > AUTO is asking: `<lastHaltQuestion>`
   >
   > Conductor cannot ground this answer in the available artifacts. Reasoning: `<one sentence — which Category, why no source applied>`.
   >
   > Provide an answer (or `cancel` to abort the task). Conductor will SendMessage your reply to AUTO and continue.

3. Exit the turn. On the user's next message, treat it as the SendMessage payload (after lightly validating it's plausibly an answer to the question), update `state.json` (`phase` back to `auto-running`, clear halt fields), and SendMessage AUTO.

## The answer protocol (Category A and B)

When answering:

1. Update `state.json`: ensure `phase = auto-running` (it was `auto-blocked-on-gate` for the duration of the decision).
2. Compose the answer message. For Category B, include a citation: `"per task-<N>/summary.md, decision: <X>"`.
3. SendMessage to `subAgentId`.
4. Move on. Do NOT also surface the question to the user — the whole point is silent autonomy when grounding is sufficient.

## Anti-patterns

- **Hedging.** Don't answer "probably approve, but maybe edit if X" — pick one and SendMessage it. AUTO's gate expects a single decision.
- **Synthesizing across categories.** A Category A part + Category C part = halt. Don't answer the easy half and leave AUTO to guess the hard half.
- **Answering with `wait`.** If conductor cannot answer, halt — do not stall AUTO with a hold-message hoping clarity emerges later.
````

- [ ] **Step 2: Verify the three categories are present**

Run: `grep -E '^### Category [ABC]' skills/conductor/answer-authority.md | wc -l`
Expected: `3`.

Run: `grep -E '^## (The rule|The halt protocol|The answer protocol|Anti-patterns)' skills/conductor/answer-authority.md | wc -l`
Expected: `4`.

- [ ] **Step 3: Commit**

```bash
git add skills/conductor/answer-authority.md
git commit -m "docs(conductor): add answer-authority heuristic reference"
```

---

## Task 5: Write `resume-procedure.md`

**Files:**
- Create: `skills/conductor/resume-procedure.md`

The phase-switched recovery primitive. Called both on `conductor resume <roadmap-id>` (explicit) and at session start when conductor detects an existing in-flight roadmap (implicit).

- [ ] **Step 1: Create `skills/conductor/resume-procedure.md`**

````markdown
# Resume Procedure

Resume is the recovery primitive after any halt or crash. It mirrors AUTO's existing pause/resume design — no sidecar magic, just reconstitution from durable artifacts.

## When this fires

- User runs `conductor resume <roadmap-id>` explicitly.
- Session start detects an existing `docs/roadmaps/<roadmap-id>/state/state.json` from a prior session.
- The user types `resume` after a halt within the same session.

## Procedure

- [ ] **Step 1: Read durable state.**

  - Read `roadmap.md`. Identify the most recent task with status `in-progress` or `halted`. If multiple, pick the one with the highest `id` (later tasks shouldn't be in-progress while earlier ones are).
  - Read `roadmap-meta.md`. Cache `baseBranch` and `integrationBranch`.

- [ ] **Step 2: Read ephemeral state.**

  - Read `state.json` from `docs/roadmaps/<roadmap-id>/state/state.json` (in the conductor worktree).
  - Verify `roadmapId` matches the directory name. Mismatch = corrupted state, halt with a clear error.
  - Recover ALL fields. Fail loudly on missing keys (treat as corrupted).

- [ ] **Step 3: Inspect the live git state.**

  Run from the main tree:

  ```bash
  git rev-parse --verify "$CURRENT_BRANCH" >/dev/null 2>&1 && echo "branch_present" || echo "branch_missing"
  git status --porcelain
  git log --oneline "$BASE_BRANCH..$CURRENT_BRANCH" 2>/dev/null | wc -l
  ```

  Run from the conductor worktree:

  ```bash
  git -C "$WORKTREE" fetch origin "$INTEGRATION_BRANCH"
  git -C "$WORKTREE" rev-list --count "$INTEGRATION_BRANCH..origin/$INTEGRATION_BRANCH"
  ```

  Capture: feat-branch presence, working-tree dirty/clean, feat-branch commit count, worktree-vs-remote integration drift.

- [ ] **Step 4: Determine sub-agent liveness (best effort).**

  If `subAgentId` is non-null, attempt a no-op SendMessage probe — for example, send a single space character. If it succeeds, mark `<alive>`. If it errors with "agent not found" or similar, mark `<gone>`. Cache this result for the status summary; do NOT yet act on it.

- [ ] **Step 5: Surface the status summary to the user.**

  Output exactly this shape (fill in the placeholders):

  ```
  Resumed roadmap <roadmapId> at task <currentTaskId> (phase: <phase>, status: <roadmap.md status>).
  - Branch: <currentBranch> (commits ahead of base: <N>, working tree: clean | dirty)
  - Phase action on resume: <copy directly from state-schema.md's enum table for this phase>
  - Last halt: <lastHaltAt> — <lastHaltQuestion>   (omit line if both are null)
  - Sub-agent: <alive | gone>
  - Integration branch drift: <N> commits behind origin   (omit if N=0)
  - Blocked tasks: <comma-separated list of pending tasks whose deps include the current halted task transitively, or "none">

  Resume task, restart task (revert and re-run from scratch), or abort? (resume / restart / abort)
  ```

- [ ] **Step 6: Wait for user choice. Dispatch on it.**

  - **`resume`** → execute the phase-specific resume action. See the `phase` enum table in `state-schema.md`. Concretely:
    - `auto-running` / `auto-blocked-on-gate` / `review-feedback-sent` → SendMessage `subAgentId` if `<alive>`; else re-dispatch (see Re-dispatch section in `conducting-flow.md`).
    - `awaiting-review` → dispatch the review agent on `prNumber`.
    - `review-running` → SendMessage `currentReviewId` if alive; else re-dispatch review.
    - `awaiting-merge` → verify mergeability, then merge.
    - `summary-writing` → write `summary.md` and `roadmap.md` update idempotently (check if files already exist with correct content before writing).
    - `task-halted` → ask the user for a corrective action; do not auto-retry the same failure.
    - `done` → pick the next task (transition into `dispatching`).

  - **`restart`** → revert dirty working-tree changes (`git checkout -- .`), delete the feat branch (`git branch -D <currentBranch>`), reset `state.json`'s in-flight fields (preserve `roadmapId` and `currentTaskId`; null everything else; set `phase = dispatching`), then re-run the task from the top of `conducting-flow.md`'s per-task loop.

  - **`abort`** → leave the working tree as-is. Do NOT push. Do NOT modify `roadmap.md`. Exit cleanly with a one-line summary of what state is on disk, so the user can decide what to do next.

## When the durable state is also damaged

If `roadmap.md` is unreadable, or `state.json` is unparseable JSON, or `roadmap-meta.md`'s `roadmapId` mismatches its directory:

1. Do NOT attempt to fix automatically.
2. Surface the exact error and the file path to the user.
3. Exit cleanly. The user's options: hand-fix the file, restore from git history (`git -C <worktree> log -- docs/roadmaps/<id>/roadmap.md`), or abort the roadmap entirely.

Conductor never writes corrupted state on top of corrupted state.
````

- [ ] **Step 2: Verify the procedure has 6 steps**

Run: `grep -E '^- \[ \] \*\*Step [1-6]:' skills/conductor/resume-procedure.md | wc -l`
Expected: `6`.

- [ ] **Step 3: Commit**

```bash
git add skills/conductor/resume-procedure.md
git commit -m "docs(conductor): add phase-switched resume procedure reference"
```

---

## Task 6: Write `conducting-flow.md` (the main orchestration checklist)

**Files:**
- Create: `skills/conductor/conducting-flow.md`

This is the longest file in the skill. It composes everything: schema files, answer-authority, resume-procedure, and the AUTO/Review/Merge primitives.

- [ ] **Step 1: Create `skills/conductor/conducting-flow.md`**

````markdown
# Conducting Flow

> Authoritative orchestration checklist for the conductor skill. SKILL.md sets the session up; this file owns every action thereafter.

This file references and depends on:
- `state-schema.md` — `state.json` shape and `phase` enum
- `roadmap-format.md` — `roadmap.md`, `roadmap-meta.md`, `summary.md` shapes
- `answer-authority.md` — the answer-vs-halt heuristic
- `resume-procedure.md` — for any resume scenario (see also: `SKILL.md` § Mode detection)

Read each one fully before starting.

## Session start checklist

Run these in order. Halt with a clear error on the first failure.

1. **Verify prerequisites** (per `SKILL.md` § Prerequisites): roadmap file exists, meta file exists, `gh` authenticated, working tree clean.
2. **Load `roadmap-meta.md`.** Cache `baseBranch`, `integrationBranch`, `roadmapId`.
3. **Detect existing in-flight state.** If `docs/roadmaps/<roadmapId>/state/state.json` exists, follow `resume-procedure.md` instead of init. Otherwise proceed to init.
4. **Init the integration branch** (only on fresh roadmap, no existing state):
   ```bash
   git fetch origin "$BASE_BRANCH"
   git push origin "origin/$BASE_BRANCH:refs/heads/$INTEGRATION_BRANCH"
   ```
   This creates the integration branch on the remote without touching local working trees.
5. **Init the conductor worktree.** Use `hey-d:using-git-worktrees` to create a worktree at `<repo>/.worktrees/conductor-<roadmapId>/` checked out to `$INTEGRATION_BRANCH`. Confirm with `git worktree list`.
6. **Init the state directory.** Inside the worktree:
   ```bash
   mkdir -p "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state"
   ```
   This directory is gitignored — see `.gitignore`'s `docs/roadmaps/*/state/` line.
7. **Init `state.json`** with all required fields. Use the template at `examples/state.json` and set:
   - `roadmapId` = the loaded value
   - `phase = "dispatching"` (we're about to start task selection)
   - everything else `null` or `0`

   Write atomically (temp + rename, see `state-schema.md`).
8. **Announce session start to the user.**

   > Conductor session started for roadmap `<roadmapId>`.
   > - Integration branch: `<integrationBranch>` (forked from `<baseBranch>`).
   > - Worktree: `<worktreePath>`.
   > - Tasks: `<count>` total, `<count>` pending.
   >
   > Beginning task selection.

## Per-task loop

This is the main loop. Repeat until no eligible task remains.

### Step 1: Pick the next task

- Read `roadmap.md`.
- Find tasks with `status: pending` whose every `dep` is `status: done`.
- If multiple eligible, pick the lowest `id`. (Determinism over cleverness.)
- If none eligible:
  - If pending tasks remain but none are eligible, the roadmap is **blocked** — go to "Roadmap blocked" below.
  - If no pending tasks remain, the roadmap is **complete** — go to "End of roadmap" below.

Update `state.json`:
- `currentTaskId` = picked id
- `phase = "dispatching"`
- `currentBranch` = `feat/<id>-<keys>` (derive `<keys>` from the title — kebab-case the first 3-4 significant words)
- `subAgentId` = null
- `prNumber`, `prUrl`, `currentReviewId` = null
- `fixLoopRound` = 0
- `dispatchedAt`, `autoReturnedAt` = null
- `lastHaltAt`, `lastHaltQuestion` = null

### Step 2: Mark task in-progress on the integration branch

In the conductor worktree:

```bash
# In $WORKTREE
# Edit roadmap.md: change task <id> status from "pending" to "in-progress"
# (Preserve YAML formatting exactly — only the status value changes.)
git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/roadmap.md
git -C "$WORKTREE" commit -m "chore(conductor): start task $TASK_ID — $TASK_TITLE"
git -C "$WORKTREE" push
```

The roadmap.md update lives only on the integration branch. The main tree never sees the in-progress mutation until later when the merge cascade happens.

### Step 3: Create the per-task feat branch on the main tree

Run from the main tree (NOT the worktree):

```bash
git fetch origin "$INTEGRATION_BRANCH"
git checkout -b "$CURRENT_BRANCH" "origin/$INTEGRATION_BRANCH"
```

Verify: `git rev-parse --abbrev-ref HEAD` should print `$CURRENT_BRANCH`.

If the branch already exists locally (from a crashed prior run): use `git checkout "$CURRENT_BRANCH"` and `git status --porcelain` to inspect. If clean, proceed (re-dispatch will pick up). If dirty, halt — let the user decide.

### Step 4: Assemble the AUTO dispatch prompt

The prompt MUST contain (in order):

1. **Task description** — copy verbatim from `roadmap.md` for this task.
2. **Dependency context** — for each dep id D in `deps`, paste the entire body of `task-D/summary.md` (after a `## Prior task summary: task <D>` heading). Read these from the conductor worktree (since main tree may not see merged summaries until a later fetch).
3. **Branch contract** — exact text:
   > You are on `<CURRENT_BRANCH>`, which is checked out off `<INTEGRATION_BRANCH>`. All commits land on this branch. Do NOT switch branches. When you reach the implementation step's PR-creation phase via the `pull-request` skill, the PR base MUST be `<INTEGRATION_BRANCH>`, NOT `main`. You MUST open the PR before returning success — returning without an open PR is a contract violation and conductor will halt.
4. **Continuation note** (only on re-dispatch — see § Re-dispatch below).
5. **AUTO trigger** — prefix with `AUTO:` so the brainstorming skill enters AUTO mode.

### Step 5: Dispatch AUTO

Use the Agent tool. Capture the returned agent ID.

Update `state.json`:
- `subAgentId` = returned id
- `dispatchedAt` = now (ISO-8601)
- `phase = "auto-running"`

### Step 6: Handle AUTO's return

AUTO will return at one of three points. Inspect its final message to classify:

- **Success** — message contains a PR URL/number reference and "Checkpoint 3 + 3.5 passed" (or equivalent). Go to Step 7.
- **Blocking gate** — message contains a question matching one of AUTO's gate shapes (Step 2 clarifying / Gate A / Gate B). Apply `answer-authority.md`:
  - Answerable → SendMessage the answer; update `state.json` (`autoReturnedAt` set, `phase` stays `auto-running`); loop back to wait for next return.
  - Not answerable → halt per `answer-authority.md` § The halt protocol; update `state.json` (`phase = auto-blocked-on-gate`).
- **Failure** — message indicates Checkpoint 3 or 3.5 rejected, or a hard error. Update `state.json` (`phase = task-halted`); halt to human with the failure surfaced.

### Step 7: Validate the PR contract

Before moving to review:

```bash
gh pr list --head "$CURRENT_BRANCH" --base "$INTEGRATION_BRANCH" --json number,url --jq '.[0]'
```

If the result is null or empty: AUTO returned success but did NOT open the PR. This is a contract violation. Update `state.json` (`phase = task-halted`, `lastHaltQuestion = "AUTO returned success without opening the PR — contract violation"`); halt.

If the result is valid: capture `prNumber` and `prUrl`. Update `state.json`:
- `prNumber`, `prUrl` set
- `autoReturnedAt` = now
- `phase = "awaiting-review"`

### Step 8: Dispatch the review agent

Dispatch a fresh sub-agent (NOT a SendMessage to AUTO) with the `requesting-code-review` skill, prompt: `Review PR #<prNumber> for completeness, correctness, and conformance to the spec at <spec-path>. Return must-fixes (list, may be empty) and nits (list, may be empty).`

Update `state.json`:
- `currentReviewId` = returned agent id
- `phase = "review-running"`

### Step 9: Process review return

Parse the review agent's return into `must-fixes` and `nits`. Then check CI:

```bash
gh pr checks "$PR_NUMBER" --watch
```

Wait for terminal state (success / failure).

Decision:
- **must-fixes empty AND CI green** → proceed to merge (Step 10).
- **must-fixes empty AND CI red** → treat as a fix-loop iteration: SendMessage AUTO with the failing CI logs as feedback. (Loop back, increment `fixLoopRound`.)
- **must-fixes non-empty (regardless of CI)** → SendMessage AUTO with the must-fixes list. (Loop back, increment `fixLoopRound`.)

When sending feedback, update `state.json`:
- `phase = "review-feedback-sent"`
- `fixLoopRound += 1`

If `fixLoopRound > 3`: halt. Update `state.json`:
- `phase = "task-halted"`
- `lastHaltQuestion = "Fix-loop exceeded 3 rounds. Latest review: <summary>. Latest CI: <green|red>."`

After AUTO pushes fixes (its return is the signal), set `phase = "review-running"` and dispatch a fresh review agent (it has no memory of prior rounds; that's intentional). Loop back to Step 9.

### Step 10: Merge the per-task PR

Update `state.json`: `phase = "awaiting-merge"`.

```bash
gh pr merge "$PR_NUMBER" --merge   # NOT --squash; preserve commits per the user's preference
```

If merge fails with a conflict against the integration branch: halt. Update `state.json`: `phase = "task-halted"`, `lastHaltQuestion = "gh pr merge failed: <error>. Conductor does not auto-resolve conflicts."`

### Step 11: Refresh the conductor worktree

The merge added commits to `$INTEGRATION_BRANCH` on the remote. The worktree is stale.

```bash
git -C "$WORKTREE" fetch origin "$INTEGRATION_BRANCH"
git -C "$WORKTREE" reset --hard "origin/$INTEGRATION_BRANCH"
```

### Step 12: Write `task-<N>/summary.md` and update `roadmap.md`

Update `state.json`: `phase = "summary-writing"`.

Inside the worktree, create `docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/`. Write `summary.md` per the shape in `roadmap-format.md`. Source material:
- `Built` — read AUTO's final return for the list of artefacts created. Cross-check against `git log $INTEGRATION_BRANCH^..$INTEGRATION_BRANCH` for the merge commit's diff.
- `Decided` — read AUTO's spec at the path AUTO returned. Extract design-decision sentences.
- `Touched` — `git diff --name-only $INTEGRATION_BRANCH^..$INTEGRATION_BRANCH`
- `Gotchas` — read AUTO's plan for any caveats; if none, write "None."

Edit `roadmap.md`: change task `<id>` status from `in-progress` to `done`.

```bash
git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/
git -C "$WORKTREE" commit -m "chore(conductor): complete task $TASK_ID — $TASK_TITLE"
git -C "$WORKTREE" push
```

Update `state.json`:
- `phase = "done"`
- Delete the local feat branch (`git -C <main-tree> branch -D <currentBranch>`).

Loop back to Step 1.

## Re-dispatch (when SendMessage fails)

If a `SendMessage` to `subAgentId` or `currentReviewId` fails with "agent not found" (or similar), the agent is gone. Recover via re-dispatch:

1. For AUTO: build a fresh dispatch prompt as in Step 4, BUT add the **continuation note** at the end:
   > This is a continuation of a prior interrupted run. The branch `<CURRENT_BRANCH>` may already contain commits, a spec under `docs/specs/`, or a plan under `docs/plans/`. Inspect the branch state before starting; do not duplicate already-committed work. The prior run's last known halt was: `<lastHaltQuestion>`.

2. For Review: just re-dispatch with the same prompt. Reviews are stateless across rounds.

Update `state.json` with the new agent id. Continue the loop.

## End of roadmap

When no pending tasks remain:

1. Switch state phase to `done` (final task done).
2. Read all `task-<N>/summary.md` files in order. Build the **final PR description**:

   ```markdown
   # Roadmap: <roadmap title>

   <copy the description from roadmap.md>

   ## Tasks completed (<count>)

   ### Task 1: <title>
   <inline the entire summary>

   ### Task 2: <title>
   <...>

   ## Statistics

   - Tasks completed: <N>
   - PR commits preserved: <count from `git log --oneline $BASE_BRANCH..$INTEGRATION_BRANCH | wc -l`>
   - Spec files added: <list>
   - Plan files added: <list>
   ```

3. Open the final PR:
   ```bash
   gh pr create --base "$BASE_BRANCH" --head "$INTEGRATION_BRANCH" \
     --title "Roadmap: <roadmap title>" --body-file <description-file>
   ```

4. **Do NOT auto-merge.** This is the human's final gate.

5. Report to user:

   > Roadmap `<roadmapId>` complete. Final PR: `<url>`.
   > <count> tasks merged into `<integrationBranch>`. Awaiting your review and merge.

6. Run worktree cleanup:
   ```bash
   git worktree remove "$WORKTREE"
   ```
   This removes the directory; the gitignored `state/` goes with it.

7. Exit the skill cleanly.

## Roadmap blocked

If pending tasks remain but none are eligible (every pending task has at least one dep that is `halted` or `failed`):

1. Surface the cascade to the user:

   > Roadmap blocked. The following pending tasks are waiting on tasks that did not complete:
   > - Task `<id>`: blocked by `<dep-id>` (status: `<halted|failed>`)
   > - …

2. Do NOT open the final PR. Do NOT clean up the worktree. The roadmap is salvageable if the user fixes the upstream task.

3. Exit. The user's recovery options:
   - Resume the upstream halted task (`conductor resume <roadmapId>`, then chase the halt)
   - Manually edit `roadmap.md` to mark a task `done` if they completed it out-of-band
   - Abort and delete the integration branch

## Halt-to-human

Whenever conductor halts (any `phase = "task-halted"` transition, or any contract-violation case above): exit the turn with the surface message described in `answer-authority.md` § The halt protocol or the equivalent for non-gate halts (failed merge, fix-loop exceeded, etc.). On the user's next message, treat it as a directive: typically `resume`, `restart`, `abort`, or a free-form correction.
````

- [ ] **Step 2: Verify per-task loop has 12 steps**

Run: `grep -E '^### Step (1[0-2]|[1-9]):' skills/conductor/conducting-flow.md | wc -l`
Expected: `12`.

- [ ] **Step 3: Verify all section headings are present**

Run: `grep -E '^## (Session start checklist|Per-task loop|Re-dispatch|End of roadmap|Roadmap blocked|Halt-to-human)' skills/conductor/conducting-flow.md | wc -l`
Expected: `6`.

- [ ] **Step 4: Commit**

```bash
git add skills/conductor/conducting-flow.md
git commit -m "feat(conductor): add main orchestration flow"
```

---

## Task 7: Add example artifacts

**Files:**
- Create: `skills/conductor/examples/roadmap.md`
- Create: `skills/conductor/examples/roadmap-meta.md`
- Create: `skills/conductor/examples/task-summary.md`
- Create: `skills/conductor/examples/state.json`

These are concrete copy-paste templates referenced from `roadmap-format.md` and `state-schema.md`. They serve as both human-readable templates AND quasi-test-fixtures (anyone reading them can validate against the format docs).

- [ ] **Step 1: Create `skills/conductor/examples/roadmap.md`**

````markdown
# Roadmap: Example — Auth Rewrite

Migrate from session-cookie auth to JWT-based stateless auth across the API and admin dashboard, preserving sign-in/sign-out UX and adding a feature flag for staged rollout.

## Tasks

```yaml
tasks:
  - id: 1
    title: "Add JWT verification middleware and types"
    deps: []
    status: pending
  - id: 2
    title: "Migrate session store to Redis"
    deps: [1]
    status: pending
  - id: 3
    title: "Wire feature flag for staged rollout to 10% traffic"
    deps: [1, 2]
    status: pending
```
````

- [ ] **Step 2: Create `skills/conductor/examples/roadmap-meta.md`**

```markdown
---
roadmapId: example-auth-rewrite
baseBranch: main
createdAt: 2026-04-30T10:00:00Z
owner: dev@zapass.co
integrationBranch: conductor/example-auth-rewrite
---

This is a worked example of `roadmap-meta.md`. Copy and edit for your own roadmap.
```

- [ ] **Step 3: Create `skills/conductor/examples/task-summary.md`**

```markdown
# Task 1: Add JWT verification middleware and types

**Branch:** `feat/1-jwt-middleware`
**PR:** #42 (merged at 2026-04-30T15:30:00Z)
**AUTO spec:** `docs/specs/2026-04-30-jwt-middleware-design.md`
**AUTO plan:** `docs/plans/2026-04-30-jwt-middleware.md`

## Built

- Added `verifyJwt` middleware in `src/auth/middleware.ts`
- Wired middleware into the request pipeline in `src/server.ts:42`
- Defined `JwtPayload` type in `src/auth/types.ts`
- Added unit tests in `tests/auth/middleware.test.ts`

## Decided

- Used HS256 instead of RS256 because we don't yet have a key-rotation pipeline. Re-evaluate after rollout.
- Token TTL set to 15min; refresh-token flow deferred to task 3.
- Middleware mutates `req.user`; downstream handlers MUST treat it as set.

## Touched

- `src/auth/middleware.ts` (new)
- `src/auth/types.ts` (new)
- `src/server.ts` (modified)
- `tests/auth/middleware.test.ts` (new)
- `package.json` (added `jsonwebtoken` dep)

## Gotchas

- HS256 secret is read from `process.env.JWT_SECRET`; tests need that env var or they will skip.
- The middleware does NOT validate token expiry separately — it relies on `jsonwebtoken`'s built-in check. If you mock the lib in tests, mock `verify` not the helper.
```

- [ ] **Step 4: Create `skills/conductor/examples/state.json`**

```json
{
  "roadmapId": "example-auth-rewrite",
  "currentTaskId": 2,
  "currentBranch": "feat/2-redis-session-store",
  "subAgentId": "a8f4c0ee04af6b333",
  "dispatchedAt": "2026-04-30T15:35:00Z",
  "autoReturnedAt": "2026-04-30T16:08:47Z",
  "phase": "awaiting-review",
  "lastHaltAt": null,
  "lastHaltQuestion": null,
  "fixLoopRound": 0,
  "currentReviewId": null,
  "prNumber": 43,
  "prUrl": "https://github.com/example/repo/pull/43"
}
```

- [ ] **Step 5: Verify all four examples are well-formed**

Run: `python3 -c 'import json; json.load(open("skills/conductor/examples/state.json"))' && echo OK`
Expected: `OK`.

Run: `grep -E '^- id: [0-9]+$' skills/conductor/examples/roadmap.md | wc -l`
Expected: `3`.

Run: `grep -E '^## (Built|Decided|Touched|Gotchas)$' skills/conductor/examples/task-summary.md | wc -l`
Expected: `4`.

Run: `grep -E '^(roadmapId|baseBranch|integrationBranch):' skills/conductor/examples/roadmap-meta.md | wc -l`
Expected: `3`.

- [ ] **Step 6: Commit**

```bash
git add skills/conductor/examples/
git commit -m "docs(conductor): add roadmap, meta, summary, and state.json examples"
```

---

## Task 8: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

Adds the per-machine state directory exclusion. Without this, `state.json` would be committed and leak machine-specific runtime state into project history.

- [ ] **Step 1: Read current `.gitignore`**

Run: `cat .gitignore`

Expected to see (per the spec's prerequisite scan): `.worktrees/`, `.private-journal/`, `.claude/`, `.DS_Store`, `node_modules/`, `inspo`, `triage/`, `tmp/`.

- [ ] **Step 2: Append the new line**

Open `.gitignore` and add at the end (preserving any trailing newline):

```
docs/roadmaps/*/state/
```

- [ ] **Step 3: Verify**

Run: `grep -E '^docs/roadmaps/\*/state/$' .gitignore`
Expected: matches.

- [ ] **Step 4: Smoke-test the rule**

```bash
mkdir -p docs/roadmaps/test/state
echo '{}' > docs/roadmaps/test/state/state.json
git status --porcelain docs/roadmaps/test/state/
```
Expected: empty output (file is ignored).

Then clean up:
```bash
rm -rf docs/roadmaps/test
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore(conductor): gitignore per-machine roadmap state directory"
```

---

## Task 9: Write the manual end-to-end procedure

**Files:**
- Create: `skills/conductor/manual-test.md`

Conductor has no automated tests (it's a markdown skill). Validation is a manual e2e against a real but throwaway 2-task roadmap. This file is the procedure.

- [ ] **Step 1: Create `skills/conductor/manual-test.md`**

````markdown
# Manual End-to-End Test

Conductor is a markdown skill — its execution is the LLM following the documented flow against real git/GitHub/AUTO state. The only meaningful test is a manual run against a throwaway roadmap. This file is the procedure.

Run this whenever:
- The skill files have changed in a non-trivial way
- Before declaring a release that includes conductor
- When debugging a real-roadmap failure that might be a skill bug rather than user error

## Prerequisites

- A scratch GitHub repo (or a scratch branch in this repo) where you don't mind seeing test commits.
- `gh` authenticated against that repo.
- A clean working tree.

## The throwaway roadmap

Create `docs/roadmaps/test-conductor-smoke/roadmap.md`:

````markdown
# Roadmap: Conductor Smoke Test

Two trivial tasks that exercise the full conductor flow without doing anything risky.

## Tasks

```yaml
tasks:
  - id: 1
    title: "Add a one-line README note about the test"
    deps: []
    status: pending
  - id: 2
    title: "Add a second one-line note referencing task 1"
    deps: [1]
    status: pending
```
````

Create `docs/roadmaps/test-conductor-smoke/roadmap-meta.md`:

```markdown
---
roadmapId: test-conductor-smoke
baseBranch: main
createdAt: <today ISO-8601>
owner: <your email>
integrationBranch: conductor/test-conductor-smoke
---
```

Commit both files to a feature branch (NOT main), open a PR for review of the seed files, merge them, then run conductor.

## The run

1. Invoke conductor: `conductor test-conductor-smoke` (or however the user-facing trigger ends up shaped).
2. Verify session-start announcement: integration branch + worktree path + task counts.
3. Watch task 1 dispatch. Confirm the dispatch prompt contains the branch contract verbatim. Confirm AUTO commits land on `feat/1-readme-note` and a PR opens against `conductor/test-conductor-smoke`.
4. Watch the review-fix loop. For a one-line change, expect: 0 must-fixes, green CI, immediate merge.
5. Verify the integration branch now has the merge commit (`git -C .worktrees/conductor-test-conductor-smoke log -1 --oneline`).
6. Verify `task-1/summary.md` was written with all four sections present.
7. Verify the worktree's `roadmap.md` shows task 1 as `done`.
8. Watch task 2 dispatch. Confirm the dispatch prompt includes task-1's summary as dependency context.
9. Repeat verification for task 2.
10. Verify final PR opens (`conductor/test-conductor-smoke` → `main`) with both summaries aggregated in the body.
11. Verify conductor does NOT auto-merge the final PR.
12. Verify `git worktree list` shows the conductor worktree was removed.

## Halt-path tests (do at least one per release)

- **Halt by inability to answer:** Manually edit task-1's title to something ambiguous mid-dispatch (race condition, but workable). Confirm conductor halts at `auto-blocked-on-gate` rather than guessing.
- **Halt by fix-loop exhaustion:** Inject 4 rounds of must-fixes (use a review prompt that always returns one fix). Confirm halt at round 4 with `task-halted` phase.
- **Resume after halt:** Trigger a halt, type `resume <correction>`, confirm conductor SendMessages and continues. Verify state.json transitions correctly.

## Cleanup

After a successful run:

```bash
gh pr close --delete-branch <final-pr-number>
git push origin --delete conductor/test-conductor-smoke
git branch -D feat/1-readme-note feat/2-readme-note 2>/dev/null
rm -rf docs/roadmaps/test-conductor-smoke
git commit -am "chore: cleanup conductor smoke test"
```
````

- [ ] **Step 2: Verify the procedure has 12 numbered run steps**

Run: `awk '/^## The run/,/^## Halt-path tests/' skills/conductor/manual-test.md | grep -cE '^[0-9]+\.'`
Expected: `12`.

- [ ] **Step 3: Commit**

```bash
git add skills/conductor/manual-test.md
git commit -m "docs(conductor): add manual end-to-end test procedure"
```

---

## Task 10: End-to-end structural smoke check

**Files:**
- (Read-only.) `skills/conductor/**`

Ensures every spec-required file exists, every spec-required heading is present, and the cross-references between files match. This is the only "did I do it all" check.

- [ ] **Step 1: Verify all expected files exist**

```bash
ls skills/conductor/SKILL.md \
   skills/conductor/conducting-flow.md \
   skills/conductor/state-schema.md \
   skills/conductor/roadmap-format.md \
   skills/conductor/answer-authority.md \
   skills/conductor/resume-procedure.md \
   skills/conductor/manual-test.md \
   skills/conductor/examples/roadmap.md \
   skills/conductor/examples/roadmap-meta.md \
   skills/conductor/examples/task-summary.md \
   skills/conductor/examples/state.json
```

Expected: all 11 paths print successfully (no `No such file` errors). Failure = a task was skipped.

- [ ] **Step 2: Verify YAML frontmatter on `SKILL.md`**

Run: `head -3 skills/conductor/SKILL.md`
Expected first line: `---`
Expected second line: `name: conductor`
Expected third line begins with: `description:`

- [ ] **Step 3: Verify cross-references resolve**

Run: `grep -oE '`[a-z-]+\.md`' skills/conductor/conducting-flow.md skills/conductor/SKILL.md | sort -u`

For each referenced filename, verify it exists in `skills/conductor/`. Manually walk the output. Any reference to a file that doesn't exist is a broken cross-reference and a bug.

- [ ] **Step 4: Verify the gitignore line is in effect**

```bash
git check-ignore -v docs/roadmaps/anything/state/state.json
```
Expected: a line matching the rule (the path is ignored).

- [ ] **Step 5: Verify the commit graph**

Run: `git log --oneline | head -10`

Expected to see (in reverse chronological order, the 9 commits this plan added):

1. `docs(conductor): add manual end-to-end test procedure`
2. `chore(conductor): gitignore per-machine roadmap state directory`
3. `docs(conductor): add roadmap, meta, summary, and state.json examples`
4. `feat(conductor): add main orchestration flow`
5. `docs(conductor): add phase-switched resume procedure reference`
6. `docs(conductor): add answer-authority heuristic reference`
7. `docs(conductor): add roadmap and task-summary format reference`
8. `docs(conductor): add state.json schema and phase enum reference`
9. `feat(conductor): scaffold SKILL.md entry point`

If any commit is missing or out of order, investigate. Conductor's task-by-task structure should produce exactly this sequence.

- [ ] **Step 6: Verify the skill is discoverable**

Restart the Claude Code session (or reload skills if the harness supports it). The skill should appear in the available-skills list as `hey-d:conductor`.

If it does not appear: check the YAML frontmatter is well-formed (no tabs, no missing colons), check the file is at the exact path `skills/conductor/SKILL.md`, and check there are no syntax errors in the description field (it's one long string; no embedded newlines without `>` block scalar).

- [ ] **Step 7: No commit**

This task is verification only. If anything fails, fix the offending file and amend its task's commit (or add a new fix-up commit), do NOT add a "smoke check" commit.

---

## Self-Review

Run after Task 10. Compare the produced files against `docs/specs/2026-04-30-conductor-design.md`:

- **Architecture invariants** — Conductor session is long-lived (✓ in SKILL.md and conducting-flow.md), AUTO is unchanged (✓ in answer-authority.md and conducting-flow.md), per-task work merges to integration branch never main (✓ in conducting-flow.md § per-task loop), main working tree stays available for AUTO (✓ in conducting-flow.md and resume-procedure.md).
- **State persistence model** — Durable artefacts on integration branch (✓ in roadmap-format.md), ephemeral state.json gitignored in worktree only (✓ in state-schema.md and .gitignore), worktree discipline rules (✓ in conducting-flow.md § session start checklist + per-task loop's branch ops).
- **Per-task lifecycle** — All 12 steps mapped to per-task loop steps in conducting-flow.md.
- **Phase enum** — All 10 phases defined in state-schema.md, transitions complete, resume actions per-phase in resume-procedure.md.
- **Answer authority** — Three categories present, halt protocol present, answer protocol present, anti-patterns documented.
- **Risks & open questions from spec § Risks** — Sub-agent process lifetime addressed via re-dispatch in conducting-flow.md § Re-dispatch. GitHub-only assumption documented in SKILL.md prerequisites. Concrete schemas defined in roadmap-format.md and state-schema.md. Multiple-conductor-sessions warning is acceptable to omit at v1 (matches spec § Risk 4 mitigation: "documented as a v1 constraint"). Roadmap-level halt cascade covered by conducting-flow.md § Roadmap blocked.

If anything in the spec isn't covered: add a task or fix the existing one.

**Placeholder scan:** grep for "TBD", "TODO", "XXX", "fill in", "implement later" across all skill files:

```bash
grep -EnH '(TBD|TODO|XXX|fill in|implement later)' skills/conductor/**/*.md skills/conductor/**/*.json
```
Expected: no matches. (Note: matches inside example task-summary content are fine — see if they refer to user-facing placeholders or actual gaps.)

**Type / name consistency:**
- `state.json`'s `subAgentId` field name appears consistently across `state-schema.md`, `conducting-flow.md`, `resume-procedure.md`, `answer-authority.md` — never `subagentId`, `agent_id`, etc.
- `phase` values appear in their exact lowercase-hyphen form (`auto-blocked-on-gate`, NOT `auto_blocked_on_gate` or `AutoBlockedOnGate`).
- `currentBranch` vs. `current-branch` etc. — pick one. (Spec uses camelCase; stick with it.)

If any drift is found: fix inline in the affected file, amend that file's task commit. Do NOT introduce a "fix consistency" commit.

---

**Plan complete and saved to `docs/plans/2026-04-30-conductor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
