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

0. **Detect or reuse a stashed seed bundle.**

   State.json doesn't exist yet at this point (it's initialized in Step 7 inside the worktree). The recovery primitive for the seed-commit pipeline is therefore a **deterministic git stash message** — the stash itself records the pending hand-off across crashes.

   Stash message format: `conductor:<roadmap-id>:seed`

   a. Check for an existing stash entry with that exact message:
      ```bash
      git stash list | grep "conductor:<roadmap-id>:seed"
      ```

   b. **If an existing stash entry is found** (resume after a Step-0..Step-5a crash): do nothing here. Step 5a will pop it once the worktree is built. Skip to Step 1.

   c. **Otherwise**, scan the working tree:
      ```bash
      git status --porcelain -- "docs/roadmaps/<roadmap-id>/"
      ```

      - If output is empty → no-op (user pre-committed the seed files, the v1 path). Skip to Step 1.
      - If output is non-empty → stash the whitelisted files:
        ```bash
        git stash push --include-untracked \
          -m "conductor:<roadmap-id>:seed" \
          -- "docs/roadmaps/<roadmap-id>/"
        ```
        The deterministic message is the recovery contract.

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

5a. **Check for the seed stash and pop it into the worktree if present.**

    ```bash
    STASH_REF=$(git stash list | grep "conductor:<roadmap-id>:seed" | head -1 | cut -d: -f1)
    ```

    - If `STASH_REF` is empty → no-op (user pre-committed; v1 path). Skip to Step 6.
    - If `STASH_REF` is set:
      ```bash
      git -C "$WORKTREE" stash pop "$STASH_REF"
      git -C "$WORKTREE" add "docs/roadmaps/<roadmap-id>/"
      git -C "$WORKTREE" commit -m "chore(conductor): seed roadmap <roadmap-id>"
      git -C "$WORKTREE" push
      ```

    The main tree is now clean. The seed files are committed durably on the integration branch and will reappear in the main tree's working area when conductor checks out the per-task feat branch (Step 3 of the per-task loop), since that branch is forked from the integration branch.

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

The dispatch prompt MUST begin with the literal token `AUTO:` (this is what triggers AUTO mode in the brainstorming skill). After that prefix, the prompt body contains four sections in this order:

1. **Task description** — copy verbatim from `roadmap.md` for this task.
2. **Dependency context** — for each dep id D in `deps`, paste the entire body of `task-D/summary.md` (after a `## Prior task summary: task <D>` heading). Read these from the conductor worktree (since main tree may not see merged summaries until a later fetch). **If `deps` is empty, omit this section entirely (do not write a heading).**
3. **Branch contract** — exact text, with `$CURRENT_BRANCH` and `$INTEGRATION_BRANCH` substituted with their actual values from `state.json` and `roadmap-meta.md` before sending (do NOT pass the literal placeholders through):
   > You are on `$CURRENT_BRANCH`, which is checked out off `$INTEGRATION_BRANCH`. All commits land on this branch. Do NOT switch branches. When you reach the implementation step's PR-creation phase via the `pull-request` skill, the PR base MUST be `$INTEGRATION_BRANCH`, NOT `main`. You MUST open the PR before returning success — returning without an open PR is a contract violation and conductor will halt.
4. **Continuation note** (only on re-dispatch — see § Re-dispatch below).

**Branch-key derivation for `$CURRENT_BRANCH`:** lowercase the task title; drop stop-words (`a`, `an`, `the`, `about`, `and`, `or`, `to`, `for`, `of`, `in`, `on`); take the first 3 of the remainder; hyphen-join. So `"Add a one-line README note about the test"` → `feat/1-add-one-line-readme`. This rule is deterministic — two LLMs running the same roadmap produce the same branches.

Final prompt shape (illustrative for task 2 with deps=[1]):
```
AUTO: <task description>

## Prior task summary: task 1

<task-1/summary.md body verbatim>

## Branch contract

You are on `feat/2-add-second-one-line`, which is checked out off `conductor/test-conductor-smoke`. All commits land on this branch. ...
```

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
  - Not answerable → recoverable halt: follow § Halt-to-human with `phase = "auto-blocked-on-gate"`.
- **Failure** — message indicates Checkpoint 3 or 3.5 rejected, or a hard error. Terminal halt: follow § Halt-to-human with `phase = "task-halted"` and the failure as `lastHaltQuestion`.

### Step 7: Validate the PR contract

Before moving to review:

```bash
gh pr list --head "$CURRENT_BRANCH" --base "$INTEGRATION_BRANCH" --json number,url --jq '.[0]'
```

If the result is null or empty: AUTO returned success but did NOT open the PR. This is a contract violation. Terminal halt: follow § Halt-to-human with `phase = "task-halted"` and `lastHaltQuestion = "AUTO returned success without opening the PR — contract violation"`. If the result has more than one PR matching `--head $CURRENT_BRANCH --base $INTEGRATION_BRANCH` (count > 1, e.g., a stale PR from a crashed prior run), terminal halt with `lastHaltQuestion = "Multiple open PRs match this task's branch — manual cleanup needed"`.

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

Decision (depends on `fixLoopRound`):

- **(any round) must-fixes empty AND CI green** → proceed to merge (Step 10).
- **`fixLoopRound < 2`, must-fixes non-empty (regardless of CI)** → SendMessage AUTO with the must-fixes list. Loop back, increment `fixLoopRound`.
- **`fixLoopRound < 2`, must-fixes empty AND CI red** → SendMessage AUTO with the failing CI logs. Loop back, increment `fixLoopRound`.
- **`fixLoopRound == 2`, must-fixes empty AND CI red** → this is the **CI-flake safety round**. SendMessage AUTO asking it to push an empty no-op commit to retrigger CI (or, if AUTO declines, conductor itself runs `git -C <main-tree> commit --allow-empty -m "chore: retrigger CI" && git push`). Loop back, increment `fixLoopRound` (now 3).
- **`fixLoopRound == 2`, must-fixes non-empty** → halt. The third round is reserved for CI flake retries only; a second round of must-fixes signals the task is in trouble and needs human intervention.
- **`fixLoopRound >= 3` AND NOT success** → halt. Anything that reaches round 3 and is not the green/empty success case (must-fixes still present, or CI still red after the flake retry) is a hard stop.

When sending feedback (loop-back), update `state.json`:
- `phase = "review-feedback-sent"`
- `fixLoopRound += 1`

When halting (any `task-halted` transition above), follow § Halt-to-human (commits `halted` to `roadmap.md` and surfaces to the user with `lastHaltQuestion = "Fix-loop exceeded N rounds. Latest review: <summary>. Latest CI: <green|red>."`).

After AUTO returns from a feedback SendMessage, classify the return — but note that the **success criterion is different from Step 6's initial-dispatch criterion**. After feedback, AUTO will not emit a fresh "Checkpoint 3 + 3.5 passed" banner; instead, success looks like "fixes pushed for [list]" or simply "done, pushed" or any return that is neither a gate question nor a failure indication.

Concretely:
- If the return is a **gate question** (matches one of AUTO's gate shapes) → apply `answer-authority.md` (and route through the same answer/halt branches as Step 6).
- If the return is a **failure** (Checkpoint 3 / 3.5 rejected, or hard error) → terminal halt per § Halt-to-human.
- Otherwise treat as **success-fixes-pushed**: set `phase = "review-running"` and dispatch a fresh review agent (it has no memory of prior rounds; that's intentional), then loop back to Step 9.

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
- Switch the main tree off the feat branch, then delete it locally:
  ```bash
  git -C <main-tree> checkout "$BASE_BRANCH"          # or any branch other than the feat branch
  git -C <main-tree> branch -D "$CURRENT_BRANCH"
  ```
  (You CANNOT delete a branch while it is checked out — git refuses with "Cannot delete branch ... checked out at <path>". The checkout must come first.)

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

Conductor halts in two distinguishable modes, but both make the durable record reflect the halt by flipping `roadmap.md` to `halted`:

- **Recoverable halt** (`phase = "auto-blocked-on-gate"`) — AUTO returned a gate question conductor cannot answer per `answer-authority.md`. The task can resume with a human-supplied answer; no commits or merge state is wrong.
- **Terminal halt** (`phase = "task-halted"`) — fix-loop exhaustion, AUTO failure, contract violation, or failed merge. Resume options are narrower (typically `restart` or `abort`); the task may need re-dispatch or rollback.

Whenever a halt fires (either phase above):

1. **Update `state.json`**: set `phase` to the appropriate value (`auto-blocked-on-gate` for recoverable, `task-halted` for terminal), `lastHaltAt` = now, `lastHaltQuestion` = the verbatim halt reason or gate question.
2. **Commit `halted` to `roadmap.md`** in the conductor worktree (durable record):
   ```bash
   # Edit docs/roadmaps/$ROADMAP_ID/roadmap.md: flip task <id> status from "in-progress" to "halted"
   git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/roadmap.md
   git -C "$WORKTREE" commit -m "chore(conductor): halt task $TASK_ID — $REASON"
   git -C "$WORKTREE" push
   ```
   This step is identical for both halt modes — the `roadmap.md` status is the same regardless of whether the ephemeral phase is `auto-blocked-on-gate` or `task-halted`. The phase distinguishes resume strategy; the `roadmap.md` flip just records "this task is not currently progressing."
3. **Surface the halt to the user** with the message described in `answer-authority.md` § The halt protocol (for gate halts) or the equivalent text for terminal halts (failed merge, fix-loop exceeded, contract violation, AUTO failure). Include the verbatim `lastHaltQuestion` in the surface message.
4. **Exit the turn.** On the user's next message, treat it as a directive: typically `resume`, `restart`, `abort`, or a free-form correction. The resume path in `resume-procedure.md` flips `roadmap.md` status back to `in-progress` before continuing (regardless of which halt phase preceded).

This mirroring ensures the durable `roadmap.md` accurately reflects the halted state — important for crash recovery (state.json may be lost; roadmap.md is durable on the integration branch and pushed to the remote).
