# Verification Subagent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `verification-before-completion` from a rules document into a dispatch protocol backed by a dedicated Haiku-tier `verification` subagent. Main agent hands off mechanical test-parsing and requirement-checking; context stays clean.

**Architecture:** Two-file change.
1. NEW `agents/verification.md` — named subagent definition (frontmatter + system prompt) with Haiku model, contract-enforced report format.
2. REWRITE `skills/verification-before-completion/SKILL.md` — restructure from "follow these rules" into "gather inputs, dispatch the agent, act on the report."

Callers (`executing-plans` Step 3, `subagent-driven-development` before finishing) are unchanged at the interface level — they still say "use hey-d:verification-before-completion". The dispatch happens internal to the skill.

**Tech Stack:** Markdown only (agent definition + skill file).

---

## File Map

| File | Change |
|------|--------|
| `agents/verification.md` | CREATE — agent definition (frontmatter + system prompt) |
| `skills/verification-before-completion/SKILL.md` | REWRITE — dispatch protocol replaces rules document |

No caller changes. No tests (markdown only; validation is manual dispatch in Task 3).

---

### Task 1: Create `agents/verification.md`

**Files:**
- Create: `agents/verification.md`

- [ ] **Step 1: Write the agent definition file**

Create `agents/verification.md` with exactly this content:

````markdown
---
name: verification
description: Use this agent to gather evidence that a task or plan is actually complete — it runs verification commands, parses output, and checks plan requirements line-by-line against code. Returns a structured report. Never trust a completion claim that did not go through this agent.
model: haiku
---

You are a verification evidence gatherer. You do not make decisions, fix issues, or editorialize. Your only job is to run the commands you are given, read the output, check requirements against code, and report findings in a structured format.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

You cannot report `STATUS: PASS` unless you actually ran the commands in this invocation and confirmed the output yourself. If commands were given but skipped for any reason, status is `FAIL` with reason "verification not executed". This rule has no exceptions.

## Your Inputs

The caller provides four things:

- **Verification commands** — list of shell commands to run in order (e.g., `pnpm test`, `pnpm typecheck`, `pnpm lint`)
- **Requirements source** — a path to a plan file, or an inline list of requirements to verify
- **Changed files** — list of files modified during the work being verified
- **Working directory** — where to run commands from

If any input is missing, report `STATUS: FAIL` with reason "missing input: <name>".

## Your Job

1. **Run each verification command sequentially** (not in parallel). Read full output. Capture exit code and pass/fail counts.
2. **Check each requirement against the changed files.** For each requirement, point to the specific file and line range that satisfies it. If no code evidence exists, mark it unmet.
3. **Report findings** in the structured format below.

## Report Format

```
STATUS: PASS | FAIL | PARTIAL

TEST RESULTS:
  - <command>: <passed>/<total> (exit code <N>)
  - <command>: <passed>/<total> (exit code <N>)

REQUIREMENTS:
  - [✓] <requirement> — covered by <file>:<line-range>
  - [✗] <requirement> — no code evidence found
  - [?] <requirement> — ambiguous, see CONFIDENCE NOTES

FAILURES:
  - <test name or command>: <short failure reason>

CONFIDENCE NOTES:
  - <anything worth flagging: ambiguity, truncation, timeouts, flakes>
```

### Status Rules

- **PASS:** every command exited 0 AND every requirement is marked [✓]
- **FAIL:** any command failed OR any requirement is marked [✗]
- **PARTIAL:** commands passed but some requirements are [?] or the requirements source was not provided

## Execution Rules

- Commands run **sequentially** in the order given — do not reorder, skip, or improvise
- Enforce a **120-second timeout** per command. On timeout, report as failure with reason "timeout after 120s"
- If test output exceeds your context, report summary stats + first 5 failures. Flag truncation in CONFIDENCE NOTES
- Do **NOT** retry flaky tests. First result stands. Flag flakiness in CONFIDENCE NOTES if observed
- Do **NOT** offer fixes or suggest next steps. Your contract is evidence, not remediation

## Ambiguity Rule

If a requirement's wording is ambiguous (e.g., "handles edge cases" — which ones?), mark it `[?]` and describe the ambiguity in CONFIDENCE NOTES. Never pretend to know what was meant.

## What You Are NOT

- You are NOT a code reviewer. Quality assessment is out of scope.
- You are NOT a debugger. Root-cause analysis is out of scope.
- You are NOT a planner. Suggesting how to fix failures is out of scope.
- You are evidence, not judgment.
````

- [ ] **Step 2: Verify the file**

Run: `head -5 agents/verification.md`
Expected: First 5 lines should be the frontmatter:
```
---
name: verification
description: Use this agent to gather evidence ...
model: haiku
---
```

Run: `wc -l agents/verification.md`
Expected: approximately 75-80 lines

- [ ] **Step 3: Commit**

```bash
git add agents/verification.md
git commit -m "feat(agents): add verification subagent for evidence gathering"
```

---

### Task 2: Rewrite `skills/verification-before-completion/SKILL.md`

**Files:**
- Modify: `skills/verification-before-completion/SKILL.md` (full rewrite)

- [ ] **Step 1: Read the current file**

Run: `cat skills/verification-before-completion/SKILL.md`

Document the current structure — most content will be reframed, not deleted. The "Iron Law" and "Gate Function" wording stay but become descriptions of the subagent's contract, not rules for the main agent.

- [ ] **Step 2: Write the new skill content**

Replace the entire file with exactly this content:

````markdown
---
name: verification-before-completion
description: Use before claiming work is complete — dispatches the verification subagent to gather fresh evidence that tests pass and requirements are met. No completion claims without evidence.
---

# Verification Before Completion

## Overview

Claiming work is complete without evidence is dishonesty, not efficiency. This skill gathers fresh evidence via a dedicated subagent before any completion claim is allowed.

**Core principle:** Evidence before claims, always.

**Announce at start:** "I'm using the verification-before-completion skill to confirm the work is complete."

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you have not dispatched the verification subagent and received its report in this invocation, you cannot claim PASS. The agent's contract enforces this — it refuses to report PASS without having actually run the commands.

## Dispatch Protocol

### Step 1: Gather inputs

Collect the four things the verification subagent needs:

- **Verification commands** — the project's test, typecheck, and lint commands. Read from `.agents/config/commits.md` if it specifies pre-commit commands; otherwise detect (`package.json` scripts, `Makefile` targets, etc.) or ask the user.
- **Requirements source** — the plan file path if executing a plan, or an inline list of requirements extracted from the task description.
- **Changed files** — `git diff --name-only <base-branch>...HEAD` gives the list of files modified during the work being verified.
- **Working directory** — current project root (absolute path).

### Step 2: Dispatch the `verification` subagent

Use the Task tool with `subagent_type: verification` and pass the four inputs in the prompt. Example prompt structure:

```
You are verifying completion of <task-or-plan-name>.

VERIFICATION COMMANDS (run in order):
  - <command-1>
  - <command-2>

REQUIREMENTS SOURCE:
<inline list OR path to plan file>

CHANGED FILES:
  - <file-1>
  - <file-2>

WORKING DIRECTORY: <absolute-path>

Run the commands, check the requirements against the changed files, and report in the structured format defined in your system prompt.
```

### Step 3: Read the report

The subagent returns a structured report with:
- `STATUS: PASS | FAIL | PARTIAL`
- Test results with exit codes
- Per-requirement coverage markers ([✓] / [✗] / [?])
- Any failures or confidence notes

### Step 4: Act on the verdict

- **PASS** → Proceed. You may now make completion claims, citing the subagent's report as evidence.
- **FAIL** → STOP. Return the report to the caller. The caller (executing-plans, subagent-driven-development) decides how to remediate — typically by returning to task execution.
- **PARTIAL** → Treat as FAIL for completion purposes, but surface the ambiguity to the caller. Requirements marked `[?]` may need clarification from the user.

## Agent Contract Summary

The `verification` subagent:
- Runs only the commands provided, in order, sequentially
- Refuses to report PASS without running the commands
- Does not fix, retry, or suggest remediation
- Returns evidence, not judgment

Full contract: see `agents/verification.md`.

## Common Failures

| Failure mode | How it manifests | Resolution |
|--------------|------------------|------------|
| Main agent claims PASS without dispatch | No subagent invocation in the transcript | **Protocol violation.** Dispatch now. Retract any premature claim. |
| Caller accepts PARTIAL as PASS | Work completes with [?] requirements unresolved | Caller must treat PARTIAL as FAIL and surface ambiguity to user |
| Agent times out on slow tests | Report shows "timeout after 120s" | Investigate why the command is slow; split into faster subsuites if needed. Do not raise the timeout. |
| Agent truncates long test output | CONFIDENCE NOTES says "output truncated" | Re-run with targeted command (e.g., `pytest -k failing_test`) to get full signal |

## Red Flags - STOP

- Using "should", "probably", "looks good" about completion — these are pre-verification words
- About to commit/push/PR without having a verification report from this invocation
- Trusting an older verification report from a prior invocation
- Skipping dispatch because "it obviously works"

**ANY wording implying success without a fresh report from this invocation is a protocol violation.**

## Why This Matters

Confidence is not evidence. The subagent exists so the main agent cannot rationalize a skipped verification — the protocol makes skipping visible. If the transcript does not show a dispatch and report, there is no evidence, and there is no completion.

## Integration

**Called by (as REQUIRED sub-skill):**
- **hey-d:executing-plans** Step 3 — before handing off to finishing-a-development-branch
- **hey-d:subagent-driven-development** — after final reviewer, before finishing-a-development-branch

**Dispatches:**
- **`verification` subagent** (`agents/verification.md`) — Haiku-tier, contract-bound evidence gatherer

**Pairs with:**
- **hey-d:finishing-a-development-branch** — runs immediately after this skill; finishing assumes verification produced fresh evidence
````

- [ ] **Step 3: Verify the new content**

Run: `head -5 skills/verification-before-completion/SKILL.md`
Expected: frontmatter with updated description mentioning the subagent.

Run: `grep -c "subagent" skills/verification-before-completion/SKILL.md`
Expected: at least 6 occurrences (Overview, Dispatch Protocol, Agent Contract, Integration, etc.)

Run: `grep -n "Iron Law" skills/verification-before-completion/SKILL.md`
Expected: one occurrence, under `## The Iron Law`.

- [ ] **Step 4: Confirm callers remain compatible**

Callers should NOT need changes — they already invoke `hey-d:verification-before-completion` by name and follow its internal protocol. Spot-check:

Run: `grep -n "verification-before-completion" skills/executing-plans/SKILL.md skills/subagent-driven-development/SKILL.md`

Expected output: references to `hey-d:verification-before-completion` as a REQUIRED SUB-SKILL. No code changes in these files should be necessary.

If a caller references the OLD internal structure (e.g., quotes the "Gate Function" numbered list), update the caller to simply say "dispatch verification-before-completion and act on its report" — but this is unlikely given the current skill wording.

- [ ] **Step 5: Commit**

```bash
git add skills/verification-before-completion/SKILL.md
git commit -m "refactor(verification-before-completion): convert from rules doc to dispatch protocol

The skill now dispatches the verification subagent (agents/verification.md) to
gather evidence, rather than instructing the main agent to run verification
inline. Main-agent context stays clean of test output; mechanical parsing runs
on Haiku tier.

Iron Law wording preserved — it is now the subagent's contract, enforced by
the agent's system prompt."
```

---

### Task 3: Manual validation

This is not automated because the unit under test is an agent definition, not code. Validation is "dispatch the agent and confirm the report format."

**Files:**
- None modified

- [ ] **Step 1: Pick a trivial verification scenario**

Choose a scenario where the answer is known. Example: "verify that `agents/verification.md` exists and has a valid frontmatter."

Verification command: `head -1 agents/verification.md | grep -q "^---$" && echo "OK" || echo "FAIL"`
Requirement: "agents/verification.md exists and starts with frontmatter"

- [ ] **Step 2: Dispatch the agent**

Invoke the Task tool with `subagent_type: verification` and a prompt like:

```
You are verifying a trivial scenario for plan validation.

VERIFICATION COMMANDS (run in order):
  - head -1 agents/verification.md | grep -q "^---$" && echo "OK"

REQUIREMENTS SOURCE:
  - agents/verification.md exists
  - agents/verification.md starts with frontmatter

CHANGED FILES:
  - agents/verification.md

WORKING DIRECTORY: <repo-root-absolute-path>
```

- [ ] **Step 3: Confirm report format matches spec**

Check the returned report has:
- `STATUS: PASS` (both requirements met)
- `TEST RESULTS:` section with the command's exit code
- `REQUIREMENTS:` section with [✓] markers for both
- Format matches `docs/specs/2026-04-17-verification-subagent-design.md`

If the format deviates (e.g., missing REQUIREMENTS section, wrong status value), update the agent system prompt in `agents/verification.md` and re-dispatch.

- [ ] **Step 4: Commit any agent tweaks (if needed)**

If Step 3 required system-prompt adjustments:

```bash
git add agents/verification.md
git commit -m "fix(agents/verification): refine report format after manual validation"
```

If no tweaks were needed, skip this step.

---

## Release

After all tasks complete and verified, bump version to `5.0.7-d.4` and release:

```bash
./scripts/bump-version.sh 5.0.7-d.4
git add package.json .claude-plugin/ .cursor-plugin/ gemini-extension.json
git commit -m "chore: release 5.0.7-d.4"
git tag 5.0.7-d.4
git push origin hey-d
git push origin 5.0.7-d.4
```

This is a fork-only release on the same v5.0.7 upstream base.

---

## Notes for the Implementer

- This plan produces **no code** — only markdown files. There is no TDD cycle because there is no code to test against a failing-then-passing assertion.
- Task 3 is a runtime smoke test, not a unit test. It confirms the agent's report format; it does not prove the agent works in all scenarios.
- If Task 3 reveals the agent produces malformed reports, fix the system prompt in `agents/verification.md` before marking the task complete. The spec (`docs/specs/2026-04-17-verification-subagent-design.md`) is the source of truth for expected format.
- Do NOT modify callers (`executing-plans`, `subagent-driven-development`) unless Step 4 of Task 2 surfaces incompatibility. The whole point of the dispatch protocol is that callers are unchanged.
