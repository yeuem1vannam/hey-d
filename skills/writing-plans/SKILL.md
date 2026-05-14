---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Prerequisite
### Commit Config

Resolve the agent-config directory once at the start of the skill. This is the **AGENTS_DIR pattern** — every skill that reads `.agents/config/*.md` should use it, so paths stay consistent regardless of cwd (important in monorepos where cwd may not be the repo root):

```bash
AGENTS_DIR="$(git rev-parse --show-toplevel 2>/dev/null)/.agents"
# Falls back to the current workspace if not in a git repo.
```

If `$AGENTS_DIR/config/commit.md` exists, read it and apply its conventions (commit types, scopes, anti-patterns) when writing commit steps in the plan. If absent, use standard Conventional Commits defaults.

## Commit Messages

Plans MUST follow `$AGENTS_DIR/config/commit.md` exactly when generating `git commit -m` steps. The implementer reads the plan verbatim — whatever you write in the plan lands in the commit, byte-for-byte.

**Never include issue or PR references** in any commit message a plan generates: no `#<N>`, no `closes #<N>`, no `fixes #<N>`, no `refs #<N>`, no `resolves #<N>`. Don't infer them from the spec, the branch name (`epic/<N>-...` / `us/<N>-...`), or any other source. Issue refs belong in the PR body (auto-close) and the spec's Reference section (cross-link) — not in commit history (which gets squashed / cherry-picked / rebased and rots the refs).

See `$AGENTS_DIR/config/commit.md` for the source-of-truth rule and rationale.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## When to Dispatch external-researcher

If a task in the plan depends on a library API, framework pattern, or standard you're not 100% certain of, dispatch the `external-researcher` subagent (`agents/external-researcher.md`) to confirm BEFORE writing the plan's code snippets.

Why this matters: incorrect API calls, wrong type signatures, or imagined methods in a plan cascade into every task that references them. The cost of verifying upfront is small; the cost of discovering the mistake mid-execution is every dependent task needing revision.

**Typical prompts:**
- "Does `<library>.<method>` take an options object as the second argument or a callback? Plan uses it in Task 3."
- "Is `<framework>`'s hook `useX` still the recommended API as of <year>, or has it been deprecated?"
- "What's the exact shape of the response from `<API>`'s `/<endpoint>` endpoint? Need it to write the type."

Dispatch for any claim you'd be embarrassed to have wrong in a written plan. Use the agent's answer to ground the code snippets in your tasks.

**When NOT to use it:**
- Questions about the user's own code — you should have that context from brainstorming's spec
- Design decisions — the plan captures decisions already made, it doesn't make them

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use hey-d:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use hey-d:executing-plans
- Batch execution with checkpoints for review

## Re-Entry from Mid-Flight Revision

`hey-d:revising-plans` calls back into this skill when a Major revision is needed (plan is wrong, spec is right). When entering via that path:

- Focus on rewriting only the affected sections of the existing plan — do not regenerate the whole plan
- Preserve completed tasks as-is; revise only the obsolete tasks and downstream dependents
- Maintain the plan's Revision Log section added by `revising-plans`
- After the rewrite, hand back to the executor (don't prompt for execution-mode choice again)
