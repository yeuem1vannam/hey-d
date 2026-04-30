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

## Worktree discipline (load-bearing)

These five rules MUST be enforced for every operation in the per-task loop, the resume procedure, and end-of-roadmap cleanup. Violating any of them poisons subsequent dispatches or corrupts state.

1. **Conductor's CWD stays on the main tree.** Do NOT `cd` into the worktree — the working directory is inherited by Agent dispatches; if conductor's CWD becomes the worktree, AUTO would inherit it and commit to `conductor/<roadmapId>` directly. All conductor operations targeting the worktree use **absolute paths** or `git -C "$WORKTREE"` — never `cd` followed by a bare git command.
2. **AUTO inherits the main-tree CWD.** AUTO sees `feat/<N>-<keys>` checked out on the main tree and works there normally. No special instructions needed beyond the dispatch contract.
3. **Same branch never in two worktrees.** `conductor/<roadmapId>` is held by the conductor worktree, so the main tree never directly checks it out. The main tree only checks out per-task feat branches that were *branched off* `conductor/<roadmapId>`.
4. **After `gh pr merge`, refresh the worktree's ref before writing the summary.** The merge commit lands on the remote `conductor/<roadmapId>`; the worktree's local copy is stale until conductor runs `git -C "$WORKTREE" fetch && git -C "$WORKTREE" reset --hard origin/conductor/<roadmapId>` (or `pull --ff-only`). Skipping this means writing `summary.md` against a stale tip and rejecting on push.
5. **Clean up the worktree at end-of-roadmap.** Once the final PR is opened, conductor runs `git worktree remove "$WORKTREE"`. State directory (gitignored) goes with it. The integration branch survives on the remote until the human merges or deletes it.

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

If the result is valid: capture `prNumber` and `prUrl`. Also extract the spec path from AUTO's success message (AUTO's report names the spec it wrote — typically `docs/specs/<date>-<slug>-design.md`). If AUTO's message does not state the path, fall back to `git -C <main-tree> log --diff-filter=A --name-only --pretty=format: "$INTEGRATION_BRANCH..$CURRENT_BRANCH" -- docs/specs/ | head -n 1`.

Update `state.json`:
- `prNumber`, `prUrl` set
- `currentSpecPath` set (captured above)
- `autoReturnedAt` = now
- `phase = "awaiting-review"`

### Step 8: Dispatch the review agent

Dispatch a fresh sub-agent (NOT a SendMessage to AUTO) with the `requesting-code-review` skill, prompt: `Review PR #<prNumber> for completeness, correctness, and conformance to the spec at <currentSpecPath>. Return must-fixes (list, may be empty) and nits (list, may be empty).`

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

Whenever conductor transitions to `phase = "task-halted"` (any contract-violation case above, fix-loop exhaustion, AUTO failure, unanswerable gate, or failed merge), the durable side mirrors the ephemeral phase change:

1. **Update `state.json`**: set `phase = "task-halted"`, `lastHaltAt` = now, `lastHaltQuestion` = the verbatim halt reason.
2. **Commit `halted` to `roadmap.md`** in the conductor worktree:
   ```bash
   # Edit docs/roadmaps/$ROADMAP_ID/roadmap.md: flip task <id> status from "in-progress" to "halted"
   git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/roadmap.md
   git -C "$WORKTREE" commit -m "chore(conductor): halt task $TASK_ID — $REASON"
   git -C "$WORKTREE" push
   ```
3. **Surface the halt to the user** with the message described in `answer-authority.md` § The halt protocol (for gate halts) or the equivalent text for non-gate halts (failed merge, fix-loop exceeded, etc.). Include the same `lastHaltQuestion` text in the surface message.
4. **Exit the turn.** On the user's next message, treat it as a directive: typically `resume`, `restart`, `abort`, or a free-form correction. The resume path in `resume-procedure.md` flips `roadmap.md` status back to `in-progress` before continuing.

This mirroring ensures the durable `roadmap.md` accurately reflects the halted state — important for crash recovery (state.json may be lost; roadmap.md is durable on the integration branch and pushed to the remote).
