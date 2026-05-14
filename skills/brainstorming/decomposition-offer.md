# Decomposition Offer (shared partial)

> Loaded by `epic-flow.md` (Epic → User Story decomposition) and `user-story-flow.md` (User Story → Task decomposition). These flows reference this partial as their terminal step.

## Purpose

After a parent spec is written, committed, and (where applicable) pushed with its issue/branch, present the parent's Candidate list and let the user choose whether to brainstorm one of them now. This is the **terminal step** of the calling flow. The calling flow does NOT invoke any other skill after this offer completes.

## Inputs the calling flow provides

- `<parent-noun>` — e.g., "Epic" (when called from `epic-flow.md`) or "User Story" (when called from `user-story-flow.md`).
- `<child-noun-plural>` — e.g., "User Stories" or "Tasks".
- `<candidate-list>` — the bullet list from the parent spec's `Candidate ...` section.
- `<chain-target>` — what to do when the user picks a number. Calling flows specify this:
  - **Epic flow:** load `skills/brainstorming/user-story-flow.md` with `parent=epic/<N>` and `parent_issue=<N>`.
  - **User Story flow:** continue into the default Task flow in `SKILL.md`; pre-seed the Task spec's Reference section with `Part of #<story_issue>` (and `Part of #<epic_issue>` if applicable). No issue or branch is created at the Task level — `hey-d:using-git-worktrees` and `hey-d:writing-plans` own that downstream.

## Presenting the offer

Show the numbered candidate list:

> <parent-noun> branch and issue created. Candidate <child-noun-plural> from the spec:
>
> 1. <first candidate>
> 2. <second candidate>
> 3. <...>
>
> Brainstorm any of these now? (number / `stop`)

## Responses

- **A number** → activate `<chain-target>` with the picked candidate as the seed. The child flow runs to its own terminal state.
- **`stop`** → exit cleanly. **Hard terminal: do NOT invoke `writing-plans`, `using-git-worktrees`, `executing-plans`, or any other implementation skill from the calling flow.** The user can invoke those separately later if they choose.
- **Anything else** → ask once for clarification (number or `stop`).

## Why the hard terminal matters

Epic and User Story flows produce planning artifacts (spec + issue + branch). Their job ends at the decomposition offer; the user owns the decision to advance into implementation. Chaining into `writing-plans` (or any other implementation skill) directly skips that decision and pattern-matches the Task flow's terminal state onto a different mode — wrong shape.

## Guideline content (intentionally empty for now)

This partial currently covers offer **mechanics** (presentation, responses, terminal guard) only. Decomposition **heuristics** — sizing rules, shape rules, anti-patterns, when not to decompose — are deliberately not encoded here yet. Add them in a future pass once concrete examples surface what's worth codifying. Project-specific heuristics can also live in `.agents/config/decomposition.md` if/when introduced.
