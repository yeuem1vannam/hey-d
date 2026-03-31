# Commit & PR Config Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.agents/config/commits.md` and `.agents/config/github.md` config loading to the four workflow skills that produce or plan commits, and to `finishing-a-development-branch` for PR creation.

**Architecture:** Pure markdown edits — no new skill files, no code. Each affected skill gets a standard config-loading block (identical pattern to the existing `code-style.md` block in `executing-plans` and `subagent-driven-development`). `finishing-a-development-branch` gets both a commit block and a PR block.

**Tech Stack:** Markdown skill files only.

---

## File Map

| File | Change |
|------|--------|
| `skills/finishing-a-development-branch/SKILL.md` | Add commit config block + PR config block after the `## Overview` section |
| `skills/executing-plans/SKILL.md` | Add commit config block after the existing `## Code Style Config` section |
| `skills/subagent-driven-development/SKILL.md` | Add commit config block after the existing `## Code Style Config` section |
| `skills/writing-plans/SKILL.md` | Add commit config block after the `## Overview` section |

---

### Task 1: Add commit + PR config blocks to `finishing-a-development-branch`

**Files:**
- Modify: `skills/finishing-a-development-branch/SKILL.md` (after line 17, the `## The Process` heading)

- [ ] **Step 1: Insert commit and PR config sections**

Insert the following two sections between `## Overview` and `## The Process` (after line 17):

```markdown
## Commit Config

At the start of this skill, check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (commit types, scopes, co-author rules, pre-commit commands) when committing. If absent, use standard Conventional Commits defaults with no co-author attribution.

## PR Config

At the start of this skill, check if `.agents/config/github.md` exists in the project root. If it does, read it and apply its conventions when creating pull requests. Template resolution order: workspace `.github/` → org repo specified in `org-repo` field → `.agents/cache/templates/`. If absent, look for templates only in the workspace `.github/` directory.
```

- [ ] **Step 2: Verify the edit**

Read `skills/finishing-a-development-branch/SKILL.md` and confirm:
- `## Commit Config` section appears before `## The Process`
- `## PR Config` section appears before `## The Process`
- No existing content was removed or shifted incorrectly

- [ ] **Step 3: Commit**

```bash
git add skills/finishing-a-development-branch/SKILL.md
git commit -m "feat(finishing-a-development-branch): add commit and PR config loading"
```

---

### Task 2: Add commit config block to `executing-plans`

**Files:**
- Modify: `skills/executing-plans/SKILL.md` (after the existing `## Code Style Config` section, before `## The Process`)

- [ ] **Step 1: Insert commit config section**

Insert the following section after the `## Code Style Config` section (after line 23, the blank line following "If the file doesn't exist, proceed with no assumptions about code style."):

```markdown
## Commit Config

At the start of this skill, check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (commit types, scopes, co-author rules, pre-commit commands) when committing. If absent, use standard Conventional Commits defaults with no co-author attribution.
```

- [ ] **Step 2: Verify the edit**

Read `skills/executing-plans/SKILL.md` and confirm:
- `## Code Style Config` section is unchanged
- `## Commit Config` section appears immediately after `## Code Style Config`
- `## The Process` section follows after

- [ ] **Step 3: Commit**

```bash
git add skills/executing-plans/SKILL.md
git commit -m "feat(executing-plans): add commit config loading"
```

---

### Task 3: Add commit config block to `subagent-driven-development`

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md` (after the existing `## Code Style Config` section, before `## When to Use`)

- [ ] **Step 1: Insert commit config section**

Insert the following section after the `## Code Style Config` section (after line 20, the blank line following "If the file doesn't exist, proceed with no assumptions about code style."):

```markdown
## Commit Config

At the start of this skill, check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (commit types, scopes, co-author rules, pre-commit commands) when committing or instructing subagents to commit. If absent, use standard Conventional Commits defaults with no co-author attribution.
```

- [ ] **Step 2: Verify the edit**

Read `skills/subagent-driven-development/SKILL.md` and confirm:
- `## Code Style Config` section is unchanged
- `## Commit Config` section appears immediately after `## Code Style Config`
- `## When to Use` section follows after

- [ ] **Step 3: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "feat(subagent-driven-development): add commit config loading"
```

---

### Task 4: Add commit config block to `writing-plans`

**Files:**
- Modify: `skills/writing-plans/SKILL.md` (after the `## Overview` section, before `## Scope Check`)

- [ ] **Step 1: Insert commit config section**

Insert the following section after the `## Overview` section (after line 20, the blank line following `- (User preferences for plan location override this default)`):

```markdown
## Commit Config

At the start of this skill, check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (commit types, scopes) when writing commit steps in the plan. If absent, use standard Conventional Commits defaults.
```

- [ ] **Step 2: Verify the edit**

Read `skills/writing-plans/SKILL.md` and confirm:
- `## Commit Config` section appears after `## Overview`
- `## Scope Check` section follows after
- The plan document header template is unchanged

- [ ] **Step 3: Commit**

```bash
git add skills/writing-plans/SKILL.md
git commit -m "feat(writing-plans): add commit config loading"
```
