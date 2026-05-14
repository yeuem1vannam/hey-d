---
name: verification-before-completion
description: Use before claiming work is complete — dispatches the completion-verifier subagent to gather fresh evidence that tests pass and requirements are met. No completion claims without evidence.
---

# Verification Before Completion

## The Iron Law

```
No agent may claim work is complete, fixed, or passing without fresh evidence
from the completion-verifier subagent.

This is not a suggestion. This is a protocol enforcement boundary.

Claims without evidence are visible in transcripts.
Shortcuts are visible.
Rationalization is visible.
```

## When to Use This Skill

Use this skill **BEFORE claiming any of the following:**

- Tests pass
- Requirements are met
- Code is correct
- Bug is fixed
- Build succeeds
- Regression test works
- Work is complete

**Rule applies to:**
- Exact phrases ("Tests pass", "Fixed")
- Paraphrases and synonyms ("All good", "Ready to ship", "Looks correct")
- Implications of success
- ANY communication suggesting completion/correctness

## Dispatch Protocol

### Step 1: Gather the Four Inputs

The completion-verifier subagent's contract is strict. It will emit `STATUS: FAIL` with reason "missing input: <name>" if any of these four inputs is absent. Gather all four before dispatching:

- **Verification commands** — ordered list of shell commands that prove the claim (test suite, typecheck, lint, build, etc.). Resolve `AGENTS_DIR="$(git rev-parse --show-toplevel 2>/dev/null)/.agents"` (the **AGENTS_DIR pattern** — falls back to the current workspace if not in a git repo) and read from `$AGENTS_DIR/config/commit.md` when its pre-commit commands are available; otherwise detect from `package.json` / `Makefile` / project conventions, or ask the user.
- **Requirements source** — either a path to the plan file whose requirements need checking, or an inline bullet list of requirements extracted from the task description.
- **Changed files** — the files modified during the work being verified. Get via `git diff --name-only <base-branch>...HEAD`.
- **Working directory** — absolute path to the project root where the commands should run.

If you cannot gather all four, STOP. You do not know enough to verify. Don't guess. Ask the user.

### Step 2: Dispatch the completion-verifier subagent

Call the completion-verifier subagent at `agents/completion-verifier.md` (subagent_type: `completion-verifier`) with this structure — all four inputs present and clearly labeled:

```
I need verification that [claim].

VERIFICATION COMMANDS (run in order):
  - [command 1]
  - [command 2]

REQUIREMENTS SOURCE:
[inline bullet list OR path to plan file]

CHANGED FILES:
  - [file 1]
  - [file 2]

WORKING DIRECTORY: [absolute path]

Run the commands, check the requirements against the changed files, and report in the structured format defined in your system prompt. Do not paraphrase. Do not assume. Show actual output.
```

Example:
```
I need verification that the authentication fix is complete.

VERIFICATION COMMANDS (run in order):
  - npm test
  - npm run typecheck

REQUIREMENTS SOURCE:
  - Login endpoint rejects invalid credentials with 401
  - Session token is invalidated on logout
  - Rate limiter kicks in after 5 failed attempts

CHANGED FILES:
  - src/auth.js
  - src/middleware/rate-limit.js
  - tests/auth.test.js

WORKING DIRECTORY: /Users/me/projects/my-app

Run the commands, check the requirements against the changed files, and report in the structured format defined in your system prompt.
```

### Step 3: Wait for the Verification Report

The subagent will:

1. Run the command (fresh, complete, no shortcuts)
2. Report the actual output
3. Give a PASS or FAIL verdict with evidence

You will see:
- Actual command output (not paraphrased)
- Exit codes
- Pass/fail counts
- The subagent's verdict: **PASS** or **FAIL**

### Step 4: Act on the Report

**If PASS:** You now have evidence. Make your claim with confidence:
- "Tests pass [subagent ran: npm test → all 34 tests pass]"
- "Requirements met [subagent verified against checklist → 5/5 items confirmed]"

**If FAIL:** State the actual status with evidence:
- "Tests do not pass [subagent output: 3 failures in auth.test.js]"
- "Requirements not met [subagent found gaps: 2 items unverified]"

## Agent Contract Summary

When you dispatch the completion-verifier subagent, these promises are ironclad:

| Promise | What It Means |
|---------|---------------|
| Runs the command | No paraphrasing. No "should work". Fresh, complete execution. |
| Reports truth | Shows actual output. Shows actual exit codes. Shows actual failures. |
| Refuses shortcuts | Will not skip verification. Will not claim pass without evidence. |
| Admits failure | If the command fails, reports FAIL clearly with evidence. |
| No rationalization | Does not excuse failures. Does not hide bad output. |

If the subagent breaks these promises, the protocol breaks. Escalate immediately.

## Red Flags — STOP

If you recognize any of these, DO NOT dispatch:

- You don't know what to verify
- You're hoping verification will succeed (instead of knowing)
- You're thinking skipping saves time
- Your claim is "probably correct" or "should work"
- You haven't touched the code in hours and are verifying from memory
- You're tired and want the work over

Stop. Re-read the command. Clarify what you're actually verifying. Then dispatch.

## Why This Matters

From the contract:
- **Claiming success without evidence breaks trust.** Your human partner said "I don't believe you" — trust broken.
- **Undefined functions shipped.** Would crash in production.
- **Missing requirements shipped.** Incomplete features wasted time.
- **False completion → redirect → rework.** Visible in transcripts. Avoidable with evidence.

The completion-verifier subagent is there for one reason: to make dishonesty impossible. Use it.

## Integration

**Called by (as REQUIRED sub-skill):**
- **hey-d:executing-plans** - Step 3, before handing off to finishing-a-development-branch
- **hey-d:subagent-driven-development** - After final reviewer, before finishing-a-development-branch

**Dispatches to:**
- **agents/completion-verifier.md** - The completion-verifier subagent that runs commands and reports truth

**Pairs with:**
- **hey-d:finishing-a-development-branch** - Runs immediately after this skill; finishing assumes verification has produced fresh evidence
