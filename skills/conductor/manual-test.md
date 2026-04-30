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
