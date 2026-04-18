---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Hey-D works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use hey-d:subagent-driven-development instead of this skill.

## Prerequisite
### Code Style Config

Check if `.agents/config/code-style.md` exists at the repository root (the directory `git rev-parse --show-toplevel` returns; fall back to the current workspace if not in a git repo). If it does, read it and apply its conventions throughout this skill's execution — file naming, directory structure, component patterns, etc. If absent, proceed with no assumptions about code style.

**Note on `.agents/` resolution:** All `.agents/` paths in this skill — for reading config and for writing cache — resolve at the repository root, not the current workspace. In a monorepo, do not create a new `.agents/` in a subdirectory.

### Commit Config

Check if `.agents/config/commits.md` exists at the repository root. If it does, read it and apply its conventions (commit types, scopes, co-author rules, pre-commit commands) when committing. If absent, use standard Conventional Commits defaults with no co-author attribution.

**Never include issue or PR references** (e.g. `#123`) in commit messages unless `.agents/config/commits.md` explicitly instructs it. Don't infer them from context.

## The Process

### Step 0: Verify Branch
1. Run `git branch --show-current` to check the current branch
2. Confirm you are on a feature branch (not `main` or `master`)
3. If `.agents/config/branches.md` exists at the repository root, verify the branch name follows its naming convention
4. If on `main`/`master`: **STOP** — ask the user to switch to a feature branch or use hey-d:using-git-worktrees to create one before proceeding

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Verify Completion

Before claiming the plan is complete, gather fresh evidence that every task actually works.

- Announce: "I'm using the verification-before-completion skill to confirm the work is complete."
- **REQUIRED SUB-SKILL:** Use hey-d:verification-before-completion
- Run the project's full test suite, re-read the plan's requirements line by line, and confirm each one against the code.
- If anything fails or a requirement has no evidence: **STOP**, return to Step 2, and fix before proceeding.

### Step 4: Complete Development

Only after Step 3 passes with fresh evidence:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use hey-d:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## Mid-Flight Plan Revision

If during Step 2 you discover the plan doesn't match reality (approach won't work, spec was wrong, later tasks invalidated by earlier results):

- **Do NOT** silently deviate from the plan — that creates drift between the written plan and the code
- **Do NOT** force through a broken plan
- **REQUIRED SUB-SKILL:** Use `hey-d:revising-plans` to classify severity (Medium vs Major) and apply the appropriate protocol
- After `revising-plans` completes, resume where it directs you (Step 2 for Medium, Step 1 for Major)

Failing tests are not a revision trigger — use `hey-d:systematic-debugging` for those. Enter `revising-plans` only when the plan itself is defective.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **hey-d:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **hey-d:writing-plans** - Creates the plan this skill executes
- **hey-d:revising-plans** - REQUIRED when the plan diverges from reality mid-execution
- **hey-d:verification-before-completion** - REQUIRED: Confirm all tasks pass with fresh evidence before finishing
- **hey-d:finishing-a-development-branch** - Complete development after verification
