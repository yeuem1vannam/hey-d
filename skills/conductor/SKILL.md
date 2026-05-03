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
- **Working tree is clean OR has only whitelisted seed-file changes.** Run `git status --porcelain`. The output is acceptable IFF every dirty path matches `docs/roadmaps/<roadmap-id>/*.md` (i.e., the seed files for THIS roadmap). Any non-whitelisted dirty path → abort: "Uncommitted work outside `docs/roadmaps/<roadmap-id>/`. Commit or stash before invoking conductor." This relaxation enables the auto-commit hand-off described in `conducting-flow.md` § Step 0.
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
