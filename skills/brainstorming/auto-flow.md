# Brainstorming: Auto Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares an Auto brainstorm (e.g., "AUTO:…", "auto brainstorm", "run auto", "end-to-end").
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## What Auto mode is (and isn't)

Auto mode runs the same brainstorm → spec → plan → code pipeline as Task mode, but **collapses the per-section approval gates** into a small number of load-bearing gates, and adds three evaluator subagents that act as confidence-aware fallbacks. The artefacts (spec, plan, branch) are still written and committed so any stage can be reviewed, rewound, or amended.

Auto mode is **opt-in per invocation**. The `AUTO:` prefix declares intent for that single request only. There is no sticky "auto on/off" switch — each new request without the prefix runs the normal gated flow.

Auto mode produces Task-shaped outcomes (a plan under `docs/plans/` and a dispatched implementation). Epic- and User-Story-shaped outcomes require manual brainstorming — see the edge case below.

## Shared prerequisites

Run these before starting the Auto-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present, following the same rule described in SKILL.md.
2. **Commit Config** — read `$AGENTS_DIR/config/commit.md` if present (resolve `AGENTS_DIR="$(git rev-parse --show-toplevel 2>/dev/null)/.agents"` per the AGENTS_DIR pattern; fall back to the current workspace if not in a git repo). Apply its conventions when committing — including the no-issue-refs rule. Spec commit uses `docs(brainstorming): add spec for <name>` by default.
3. **Visual Companion** — skip. Auto mode optimises for minimum interaction; do not offer the companion. If a visual comparison is genuinely needed to disambiguate, that is a signal Auto mode is the wrong choice and you should fall back (see Checkpoint 1).

## Checklist

Create a TodoWrite task for each item and complete them in order:

1. Explore project context (bounded — files, docs, recent commits)
2. Ask clarifying questions ONLY if required to resolve load-bearing ambiguity (max 3, one per message)
3. **Checkpoint 1** — pre-spec evaluator (blocking)
4. Present a single spec preview (not per-section) and get one approval
5. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-design.md` and commit
6. Inline spec self-review (placeholder / consistency / scope / ambiguity) — fix inline
7. Write the implementation plan to `docs/plans/YYYY-MM-DD-<slug>.md` and commit
8. **Checkpoint 2** — pre-code evaluator (advisory)
9. Present the final "proceed to code?" gate and get one approval
10. Dispatch the implementation agent (with per-plan-step TodoWrite tracking — mandatory in Auto mode; see step 10 detail)
11. **Checkpoint 3** — post-code semantic review (always-on, Haiku model with Sonnet escalation)
12. **Checkpoint 3.5** — verification (run REQUIRED commands from `.agents/rules/checklist.md`)
13. Report done

## Gate summary

Auto mode has exactly **two user-facing gates** in the happy path:

- **Gate A** (after Checkpoint 1): a spec preview. **Shape depends on Checkpoint 1's path** (see step 4) — blocking (waits for explicit `approve`/`edit`/`cancel`) if the evaluator needed any clarification, advisory (presents preview, then continues immediately in the same turn — no approval prompt) if Checkpoint 1 cleared on the first try with zero questions asked.
- **Gate B** (after Checkpoint 2): a "proceed to code" preview showing the planned code-agent dispatch. **Shape depends on both checkpoints** (see step 9) — advisory (presents preview, then dispatches immediately in the same turn) ONLY when Checkpoint 1 cleared first try AND Checkpoint 2 returned `approved`; blocking in every other case.

**Important — there is no countdown timer.** "Advisory" means "no approval prompt; the orchestrator moves to the next tool call in the same turn." Claude has no mechanism to wait N seconds. The user's interrupt options are (a) Ctrl-C to stop the running session, or (b) type a message that's queued and processed on the next turn. The behaviour is auto-advance, not auto-advance-after-delay. Checkpoints 3 and 3.5 are the safety net for anything missed at Gate B.

If either evaluator fires a concern, additional mid-flow questions are surfaced — but those are fallbacks, not part of the happy path.

## Step details

### 1. Explore project context

Bounded scan: read explicit references the user points at (ticket, file, spec). Run a handful of `Grep` queries for key symbols. Do **not** dispatch an Explore subagent unless the Checkpoint 1 evaluator later demands it. If deep exploration feels necessary, that is a signal Auto mode is the wrong choice.

### 2. Ask clarifying questions (only if needed)

Ask the minimum number of questions required to reach enough signal for Checkpoint 1 to approve. If the original request is already crisp, ask zero questions and proceed straight to Checkpoint 1. Hard budget: 3 questions. If more are needed, fall back (see Checkpoint 1 edge cases).

### 3. Checkpoint 1 — pre-spec evaluator (blocking)

Dispatch an evaluator subagent with the full conversation so far (user's request, clarifying Qs and answers, exploration notes). Use the template in `## Evaluator prompts` below.

**Rubric:**
- **Load-bearing ambiguity** — any requirement that could produce materially different specs.
- **Scope decomposition** — does the request describe multiple independent subsystems?
- **Missing context** — does the request depend on a file, library, or behaviour not yet read?
- **Internal contradiction** — conflicting goals in the request or clarifying answers.

**Verdicts:**
- `approved` → proceed to Gate A.
- `ambiguity` → surface the specific question to the user, incorporate the answer, re-run Checkpoint 1.
- `multi-subsystem` → **refuse Auto mode**. Tell the user: *"This describes multiple independent subsystems. Auto mode would skip the decomposition step, which is load-bearing here. Recommend re-running as `EPIC:` — that flow has the collaborative decomposition pass that this change needs."* Exit the skill.
- `missing-context` → dispatch the named exploration (file read, `external-researcher`, etc.), then re-run Checkpoint 1.

This checkpoint is **blocking**. Do not proceed to Gate A until it returns `approved`.

### 4. Gate A — spec preview (shape depends on Checkpoint 1)

Present the spec in one message, not section by section. Use the same section structure as Task mode (Architecture, Components, Data Flow, Error Handling, Testing, scaled to complexity), but deliver them together. The **shape** of this gate depends on how Checkpoint 1 resolved:

- **Blocking shape** — use when Checkpoint 1 needed **any** clarification round (≥1 clarifying question asked to the user in step 2, or the evaluator returned `ambiguity` / `missing-context` before ultimately returning `approved`). That earlier uncertainty is the signal that you should look at the spec carefully.

  > Spec preview above. Approve, edit (describe the change), or cancel?

  Only `approve` advances. On `edit`, take the change and re-show the preview. On `cancel`, exit cleanly.

- **Advisory shape** — use when Checkpoint 1 cleared **on the first dispatch** with **zero clarifying questions asked** in step 2. In this narrow case the evaluator has already confirmed no load-bearing ambiguity and the user has nothing to correct from clarification rounds, so a blocking ask is mostly ceremony and trains the user to rubber-stamp.

  > Spec preview above. No ambiguity flagged by the pre-spec evaluator. Proceeding to write and commit the spec now — interrupt with Ctrl-C if you need to stop, or message me anything (e.g. `wait`, `edit X`, `cancel`) and it will be picked up on the next turn.

  **Behaviour:** the orchestrator emits the preview text and then immediately continues to step 5 (write and commit the spec) within the same turn. There is NO waiting period — Claude has no timer mechanism. The user's interrupt mechanism is Ctrl-C (stops the session) or queueing a message that is processed on the next turn (which can be `wait` to fall back to blocking, `edit <change>` to revise, or `cancel` to abort and revert). If the user's queued message arrives mid-coding, the orchestrator pauses per the Pause and Resume section.

In both shapes the spec IS presented before any write, so the `<HARD-GATE>` requirement (design shown + real chance to stop) is satisfied. The advisory shape is never used when Checkpoint 1's path suggests the spec warrants scrutiny.

### 5. Write and commit the spec

- Path: `docs/specs/YYYY-MM-DD-<slug>-design.md`. Slug rule matches the Epic flow.
- Commit with `docs(brainstorming): add spec for <name>` (or the scheme defined in `$AGENTS_DIR/config/commit.md`).
- Do NOT push from Auto mode. Branch/push happens as part of the normal implementation flow.

### 6. Inline spec self-review

Read the written spec once with fresh eyes. Scan for placeholders (TBD, TODO), internal contradictions, and ambiguity that slipped past Checkpoint 1. Fix inline and amend the commit. No separate review gate — this is a silent pass.

### 7. Write and commit the plan

Follow the structure described in `skills/writing-plans/SKILL.md`, but run it inline in Auto mode — do NOT pause for the per-task approvals that writing-plans normally offers. Commit with `docs(brainstorming): add plan for <name>`.

### 8. Checkpoint 2 — pre-code evaluator (advisory)

Dispatch an evaluator subagent with spec + plan paths. Use the template in `## Evaluator prompts` below.

**Rubric:**
- **Plan-spec alignment** — does every plan step trace to a spec requirement?
- **Scope jump** — does the plan introduce components, files, or helpers not implied by the spec?
- **Surprises** — any step that would surprise a reviewer who only read the spec?

**Verdicts:**
- `approved` → proceed to Gate B as a normal preview.
- `concerns` → surface the specific concerns inline at Gate B. The user sees both the normal preview AND the evaluator's notes. They decide: proceed, narrow the plan, or cancel. This checkpoint does NOT block on its own — the user's Gate B answer is what advances.

### 9. Gate B — proceed to code (shape depends on both checkpoints)

The shape of this gate mirrors Gate A's two-shape pattern, but with a **stricter** condition for the advisory shape — because code dispatch is a bigger step than writing a spec. The advisory shape only engages when the **entire flow so far has been high-confidence**.

**Advisory-shape conditions (ALL must hold):**
- Checkpoint 1 cleared on the first dispatch with **zero clarifying questions** in step 2, AND
- Checkpoint 2 returned `approved` (not `concerns`).

If either condition fails → use the **blocking shape**. No exceptions.

- **Blocking shape:**

  > Spec: `<spec_path>`
  > Plan: `<plan_path>`
  > Checkpoint-2 evaluator: `<approved | concerns: …>`
  >
  > Ready to dispatch the implementation agent for this plan. Proceed, edit the plan (describe the change), or cancel?

  Only `proceed` advances. On `edit`, amend the plan, re-run Checkpoint 2, re-show Gate B. On `cancel`, exit cleanly — spec and plan remain on disk.

- **Advisory shape:**

  > Spec: `<spec_path>`
  > Plan: `<plan_path>`
  > Both checkpoints cleared with no concerns. Dispatching the implementation agent now — interrupt with Ctrl-C to stop, or message me (`wait`, `edit X`, `cancel`) to be picked up on the next turn.

  **Behaviour:** the orchestrator emits the preview text and then immediately continues to step 10 (dispatch the implementation agent) within the same turn. There is NO waiting period. The user's interrupt mechanism is Ctrl-C (stops the session) or queueing a message processed on the next turn. If the user's queued message arrives mid-coding, the orchestrator pauses per the Pause and Resume section.

  The backstop is the pair of post-code checkpoints: Checkpoint 3 (semantic diff review) catches diffs that don't match the plan, and Checkpoint 3.5 (verification) catches broken builds or failing tests. Auto mode does not declare done until both pass.

### 10. Dispatch the implementation agent

Use the same implementation-dispatch path as Task mode (normally via `skills/executing-plans/` or the project's worktree + subagent pattern). Record the plan's expected-files list before dispatch — Checkpoint 3 needs it.

**TODO visibility is mandatory in Auto mode.** Because the user has waived per-section and per-step approvals at Gates A and B, the TodoWrite list IS their only live view into what the coding agent is doing. It must be detailed and kept current throughout the coding phase.

Before dispatching, the orchestrator:

1. **Expands the plan into TodoWrite tasks.** Create one TodoWrite entry per atomic step in the plan document — not one entry per plan "section." If a plan step is large (touches multiple files, multiple commits, or multiple concerns), break it into the smallest units that independently make sense to mark `in_progress` → `completed`. Err on the side of too granular.
2. **Pre-populates descriptions with concrete targets.** Each task's description must name the specific files to touch and the specific change. Not "Implement feature X" — instead "Add `foo()` to `src/bar.ts` and update the `baz` export in `src/index.ts`."
3. **Hands the task list to the implementation agent with explicit tracking rules:**
   - Mark each task `in_progress` **before** starting work on it.
   - Mark each task `completed` **immediately** upon finishing — do not batch.
   - If a new sub-step is discovered mid-implementation, add a new TodoWrite entry rather than silently expanding scope on the current one.
   - If a task is blocked or abandoned, leave it `in_progress` and surface the blocker back to the orchestrator; do NOT mark blocked work as `completed`.

The orchestrator does not need to re-present the TODO list in chat — the user watches it update live via the TodoWrite UI. The orchestrator only intervenes if tasks stall or the implementation agent reports an error.

### 11. Checkpoint 3 — post-code semantic review (always-on, cheap model)

Two layers, run in order:

**11a — File-list parity (deterministic, inline).** Run `git diff --name-only <base_branch>..HEAD` and categorise each path:

- **Expected** — changed files that appear in the plan's expected-files list.
- **Unexpected** — changed files NOT in the plan's expected-files list.

For unexpected files, capture a one-line summary of what changed there (`git diff --stat <base_branch>..HEAD -- <path>` plus a brief read of the diff).

**11b — Semantic diff review (always-on subagent, Haiku by default).** Regardless of whether the file list was clean, dispatch a semantic reviewer. File-list parity is necessary but not sufficient — within an "expected" file the agent could have made a wildly different change than the plan described. The semantic check closes that gap.

Use `Agent` with `model: "haiku"` and the Checkpoint 3 prompt template (see Evaluator prompts section). The reviewer answers one question: *does this diff plausibly match what the plan said would happen?* Verdict is `approved` (with optional notes) or `concerns` (with bullet list of mismatches).

**Escalation rule:** if Haiku returns `concerns` *and* its own confidence note is below "high", re-dispatch the same prompt with `model: "sonnet"` for a second opinion. If Sonnet still returns `concerns`, treat as concerns. If Sonnet returns `approved`, treat as approved with a note. Opus is not used at this checkpoint — overkill for a diff-vs-plan match check.

**Combined verdict and user prompt:**

- **All clean** (file list matches AND semantic reviewer approved) → proceed to Checkpoint 3.5.
- **Anything flagged** (unexpected files OR semantic concerns) → present:

  > Implementation agent finished. Concerns:
  >
  > **Unexpected files:**
  > - `<path>` — <what changed, one line>
  >
  > **Semantic concerns (model: <haiku|sonnet>):**
  > - `<concern>` — <why it matters>
  >
  > Accept (treat as part of the change), revert (specific paths), or refine (amend plan and re-run)? (accept / revert / refine)

`accept` → proceed to Checkpoint 3.5. `revert` → `git checkout -- <paths>` (or `git revert` for committed changes), then re-run Checkpoint 3. `refine` → amend the plan, re-run Checkpoint 2 on the updated plan, then re-run Checkpoint 3.

### 12. Checkpoint 3.5 — verification (run the project's "go-signal" commands)

A diff that "looks right" can still be broken — type errors, failing tests, formatting drift. Checkpoint 3.5 runs the project's own verification commands so Auto mode never reports done on a broken state.

**Source of truth:** `.agents/rules/checklist.md` at the repository root (resolved via `git rev-parse --show-toplevel`). This file is the team-wide source of truth for "non-negotiables for every implementation" and is owned by the consuming project, not by Auto mode. Auto mode only reads it.

**How to read it:**

1. Locate a section heading matching (case-insensitive) one of: `Before finishing`, `Verification`, `Pre-completion checks`. First match wins.
2. Within that section, parse each bullet/numbered item. An item is a verification command if it contains a backtick-quoted shell command (e.g. `` `CI=1 pnpm test:unit` ``).
3. Classify each item by the marker word: `REQUIRED` → must run and must pass; `RECOMMENDED` → run, but a failure is a flag, not a block; `OPTIONAL` → skip in Auto mode unless the user opted in.
4. Preserve any prefix or suffix exactly as written (e.g. `CI=1` is load-bearing — without it, some test runners hang).

**Run order:** REQUIRED first, then RECOMMENDED. Stop at the first REQUIRED failure (further checks are wasted compute). Run each command from the repository root unless the checklist file specifies otherwise.

**Combined verdict:**

- **All REQUIRED passed, all RECOMMENDED passed** → proceed to step 13.
- **All REQUIRED passed, some RECOMMENDED failed** → proceed to step 13, but include the recommendation failures in the done summary as flags (do not block).
- **Any REQUIRED failed** → STOP. Present:

  > Verification failed at REQUIRED check `<command>`:
  >
  > ```
  > <last 30 lines of stdout/stderr>
  > ```
  >
  > Options: fix (re-dispatch the implementation agent with the failure as additional context), revert (drop the change entirely), or hand off (exit Auto mode; you fix manually). (fix / revert / handoff)

  `fix` → add a TodoWrite entry for the failure, re-dispatch the implementation agent narrowly scoped to that fix, then re-run Checkpoint 3 + 3.5 on the new state. `revert` → roll back to the base branch, exit. `handoff` → exit cleanly with the failure surfaced; user takes over.

**Fallback when `.agents/rules/checklist.md` is absent:** attempt a small set of common script names from `package.json` / project root in order: `pnpm test`, `npm test`, `cargo test`, `go test ./...`. If one runs cleanly, treat its result as the REQUIRED verdict. If none match, **skip with a visible notice**:

> No `.agents/rules/checklist.md` found and no recognised default verification script. Skipping Checkpoint 3.5 — the implementation is not verified.

Visible-skip is mandatory; never silently pass.

### 13. Report done

One-line summary: spec path, plan path, branch name, Checkpoint 3 verdict (file-list + semantic + reviewer model used), Checkpoint 3.5 verdict (each command + pass/fail). Exit the skill.

## Evaluator prompts

### Checkpoint 1 prompt template

```
Agent tool (general-purpose):
  description: "Pre-spec ambiguity check"
  prompt: |
    You are an ambiguity evaluator for an auto-brainstorm flow. The orchestrator is
    about to write a spec based on the conversation below. Your job is to decide
    whether there is enough signal to produce a single correct spec, or whether a
    load-bearing ambiguity would cause cascading rework.

    **Conversation so far:**
    [paste full conversation: original request + clarifying Qs + answers + exploration notes]

    **Rubric:**
    - Load-bearing ambiguity (could produce materially different specs)
    - Scope decomposition (multiple independent subsystems)
    - Missing context (unread file/library/behaviour the spec would depend on)
    - Internal contradiction

    **Output (strict):**
    Verdict: approved | ambiguity | multi-subsystem | missing-context
    Reason: <one sentence>
    Next question (only if verdict = ambiguity): <the single question to ask the user>
    Missing context target (only if verdict = missing-context): <file path or researcher topic>
```

### Checkpoint 2 prompt template

```
Agent tool (general-purpose):
  description: "Plan-spec alignment check"
  prompt: |
    You are a plan-spec alignment evaluator for an auto-brainstorm flow. The
    orchestrator is about to dispatch a code agent against the plan. Your job is
    to flag anything in the plan that does not trace back to the spec, or anything
    a spec-only reader would find surprising.

    **Spec:** [SPEC_PATH]
    **Plan:** [PLAN_PATH]

    **Rubric:**
    - Plan-spec alignment (every plan step traces to a spec requirement)
    - Scope jump (components/files/helpers not implied by the spec)
    - Surprises (steps that would surprise a reviewer who only read the spec)

    **Output (strict):**
    Verdict: approved | concerns
    Concerns (only if verdict = concerns): bullet list, each line
      "[Plan step X]: <concern> — <why it matters>"
```

### Checkpoint 3 prompt template (semantic diff review)

```
Agent tool (general-purpose, model: "haiku"):
  description: "Diff vs plan semantic review"
  prompt: |
    You are a post-implementation diff reviewer. The orchestrator just ran a
    coding agent against a plan. Your job is to decide whether the diff plausibly
    implements what the plan said it would — no more, no less.

    **Plan:** [PLAN_PATH]
    **Diff command:** `git diff <BASE_BRANCH>..HEAD`
    (Read the file and run the command yourself.)

    **What you are checking:**
    - Does each non-trivial diff hunk trace to a step in the plan?
    - Is any plan step visibly missing from the diff (no corresponding code change)?
    - Does the diff introduce logic or behaviour the plan did not describe?

    **Calibration:**
    Approve unless there are concrete mismatches. Cosmetic differences (variable
    naming, comment wording, equivalent reformulations of the planned change)
    are NOT concerns. Only flag things that would surprise a reviewer who only
    read the plan.

    **Output (strict):**
    Verdict: approved | concerns
    Confidence: high | medium | low
    Concerns (only if verdict = concerns): bullet list, each line
      "[File or hunk]: <mismatch> — <why it matters>"
    Notes (optional, advisory): bullet list of small observations that didn't rise to a concern.
```

If Haiku returns `concerns` with confidence `medium` or `low`, re-dispatch the same prompt with `model: "sonnet"`. The Sonnet verdict is final.

## Pause and resume

Auto mode can be interrupted mid-flow and resumed on a later turn. This exists because Claude has no real timer — the only way for the user to interject during an advisory-shape gate or mid-coding is to interrupt the session. Auto mode treats those interruptions as **pauses, not aborts**, and keeps enough state to pick up cleanly.

**What counts as a pause:**

- The user types a message while the orchestrator is mid-flow (Ctrl-C on the CLI then a new prompt, or queued input). The orchestrator sees the new user turn before it finishes its own work.
- The session ends (window closed, process killed) and the user later starts a new session in the same repo.

**State the orchestrator relies on (all durable, all external to the chat):**

- **Git log** — spec commit and plan commit are pinned to `docs(brainstorming): add spec for <name>` and `docs(brainstorming): add plan for <name>`. Their presence tells the resume path which steps already ran.
- **TodoWrite list** — in-progress and completed tasks survive across turns. The current `in_progress` task is the paused step.
- **Working tree** — `git status` shows any uncommitted work-in-flight from the implementation agent.

No marker file or sidecar state is needed.

**On pause (orchestrator's side):** finish any tool call that is already in flight so the state stays coherent, then emit a single-line notice to the user:

> Auto mode paused at step <N> (<short description>). Say `continue` / `resume` to pick up, `edit <change>` to adjust and resume, or `abort` to exit. I'll inspect git + TodoWrite + working tree before doing anything.

Exit the turn. Do NOT auto-advance after a pause even if the pause happened during an advisory-shape gate — the user asking for attention overrides advisory.

**On resume (orchestrator's next turn):** when the user's message contains `continue`, `resume`, `keep going`, or `resume auto`:

1. Re-read the state: `git log`, TodoWrite, `git status`. Identify the paused step.
2. Present a short status summary:

   > Paused at step <N> — <description>.
   > - Spec: `<path>` (committed: yes/no)
   > - Plan: `<path>` (committed: yes/no)
   > - In-flight TodoWrite task: `<subject>`
   > - Working tree: clean / dirty (<file count> files)
   >
   > Resume, restart this step, or abort? (resume / restart / abort)

3. On `resume` → continue from the paused step with the same inputs. The in-flight TodoWrite task stays `in_progress` and the implementation agent (or orchestrator) picks up where it left off.
4. On `restart` → revert any dirty working-tree changes for the current step (`git checkout -- <paths>`), reset the TodoWrite task to `pending`, and re-run the step from the top.
5. On `abort` → leave the working tree as-is, exit cleanly. Spec and plan remain on disk and in git.

`edit <change>` is handled as: apply the change (e.g. amend the plan), re-run the nearest upstream checkpoint (2 or 3 depending on where the edit landed), then present `resume / restart / abort` again.

**What pause does NOT do:** it does not kill the implementation subagent if one is running. If the user wants the subagent dead, Ctrl-C the session first, then resume from a clean state. A pause that arrives via queued input while the subagent is still working will be processed after the subagent returns (or times out). This is a known limitation; document it so the user knows Ctrl-C is the real emergency stop.

## Hard-gate adaptation

The `<HARD-GATE>` block from SKILL.md still applies. Auto mode does NOT bypass it — the design is presented at Gate A and presented again (as spec+plan) at Gate B. "Approval" at Gate A can be explicit (blocking shape) or implicit-unless-vetoed (advisory shape, only when Checkpoint 1 cleared first try with zero questions). In both cases the design IS shown before any implementation action, and the user has a real chance to stop or edit. The "simple project" anti-pattern still holds: even a one-line config change passes through Gate A in one of the two shapes.

## Edge cases

- **AUTO: and EPIC: both present in the trigger.** Epic wins per the priority rule in SKILL.md. Announce Epic mode and load `epic-flow.md`.
- **Checkpoint 1 asks a clarifying question and the user's answer reveals the request is actually multi-subsystem.** Re-run Checkpoint 1; it should now return `multi-subsystem` and refuse.
- **Checkpoint 1 exhausts 3 questions and still returns `ambiguity`.** Exit Auto mode cleanly: *"Three rounds of clarification and this still has load-bearing ambiguity. Auto mode isn't a fit for this one — recommend running the normal (Task) brainstorm so we can work through the design together."* Do not silently degrade to Task mode.
- **Gate A rejected.** On `cancel` (either shape), exit cleanly. No spec is written.
- **Gate A advisory shape, user queues a message while the orchestrator is writing the spec.** Treat as a pause per the Pause and Resume section. If the message is `wait`, fall back to the blocking shape on resume and re-present the spec preview. If the message is `edit <change>`, amend the spec in place and re-present.
- **Gate A advisory shape, user stays silent.** The orchestrator continues to step 5 (write spec) in the same turn. The spec is committed, so a later correction is a cheap amend.
- **Gate B rejected.** On `cancel` (either shape), exit cleanly. Spec and plan remain on disk; the user can resume manually via `executing-plans` later.
- **Gate B advisory shape, user queues a message while the orchestrator is dispatching.** Treat as a pause per the Pause and Resume section. A `wait` falls back to the blocking shape and re-presents Gate B on resume; `edit <change>` amends the plan and re-runs Checkpoint 2 before re-presenting Gate B.
- **Gate B advisory shape, user stays silent.** The orchestrator dispatches the implementation agent in the same turn. Checkpoint 3 (semantic) and Checkpoint 3.5 (verification) are the backstops.
- **Gate A was advisory (first-try clear) but Checkpoint 2 returned `concerns`.** Gate B MUST use the blocking shape — the concerns invalidate the "whole flow was high-confidence" signal. Do not be tempted to auto-advance just because Gate A was advisory.
- **Checkpoint 2 returns `concerns` that the user accepts at Gate B.** Proceed to dispatch. The concerns are informational; the user is the decision-maker.
- **Checkpoint 3 finds unexpected files or semantic concerns but the user picks `accept`.** Record the acceptance in the done summary so the divergence is visible in chat; do not silently hide it. Both the file-list deltas and the semantic reviewer's notes appear in the summary.
- **Checkpoint 3 Haiku reviewer returns `approved` but with low confidence.** Treat `approved` as final — do not escalate to Sonnet on approved verdicts. Sonnet escalation is only for `concerns` at low/medium confidence, to avoid false negatives. Escalating approvals wastes compute.
- **Checkpoint 3.5 reads `.agents/rules/checklist.md` but the "Before finishing" section is missing or empty.** Fall back to the common-script heuristic (`pnpm test` / `npm test` / `cargo test` / `go test ./...`), and emit the visible skip notice if none match. Do NOT skip silently.
- **Checkpoint 3.5 REQUIRED command fails and the user picks `fix`.** Scope the re-dispatched implementation agent to ONLY the failure — do not let it do a general pass over the code. Include the failing command's last 30 lines of output as additional context, and re-run Checkpoints 3 and 3.5 on the new state. If it fails a second time, switch to `handoff` — Auto mode is not the right tool for stubborn failures.
- **Implementation agent fails or aborts.** Do NOT run Checkpoint 3 or 3.5 — surface the failure and pause (per Pause and Resume). The user can `resume` (re-dispatch with failure context), `restart` (revert and re-run step 10 from scratch), or `abort`. Leave the TodoWrite list in whatever state the agent left it — do NOT retroactively mark in-flight tasks as `completed`; stale state is recoverable, lies are not.
- **Implementation agent finishes the work but skipped TODO updates along the way.** This is a discipline failure of the coding agent, not a flow design issue. On the next dispatch in a fresh Auto run, re-emphasise the TODO rules in the dispatch prompt. Do NOT back-fill the TODO list after the fact — it erases the signal that the agent wasn't following the protocol.
- **A plan step turns out to be larger than expected mid-implementation.** The implementation agent adds new TodoWrite entries for the newly-discovered sub-steps rather than silently expanding the original task's scope. Scope growth is visible in the task list, not hidden in a "completed" task with a much larger diff than its description implied.
- **`.agents/config/` files missing.** Fall back to Conventional Commits defaults for commit messages; do not block the flow. Note this is separate from `.agents/rules/checklist.md` handling — see Checkpoint 3.5 for the verification fallback.
- **User messages `continue` without a prior pause.** No-op. Reply: *"No paused Auto run in this session — start a new one with `AUTO: <request>`."* Do NOT silently start a new flow.
- **Spec commit exists but plan commit is missing at resume time.** The pause happened between step 6 and step 7. Resume by running step 7 (write and commit plan), then Checkpoint 2, then Gate B.
- **Plan commit exists but implementation work is missing/partial at resume time.** The pause happened at or after step 10. Inspect TodoWrite for the in-flight task and `git status` for dirty files, then present the `resume / restart / abort` prompt per Pause and Resume.
