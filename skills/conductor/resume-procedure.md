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
