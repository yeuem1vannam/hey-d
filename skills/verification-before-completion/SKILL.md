---
name: verification-before-completion
description: Use before claiming work is complete — dispatches the verification subagent to gather fresh evidence that tests pass and requirements are met. No completion claims without evidence.
---

# Verification Before Completion

## The Iron Law

```
No agent may claim work is complete, fixed, or passing without fresh evidence
from the verification subagent.

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

### Step 1: Identify What Needs Verifying

Before dispatching, answer these questions:

- **What claim am I making?** ("Tests pass", "Requirements met", etc.)
- **What command proves this?** (test suite, build command, grep pattern, etc.)
- **What does success look like?** (exit code 0, all tests pass, error count 0, etc.)

If you can't answer these, STOP. You don't know what to verify. Don't guess.

### Step 2: Dispatch the verification subagent

Call the verification subagent at `agents/verification.md` with this structure:

```
I need verification that [claim]. Here's what to verify:

Command to run: [exact command]
Success criteria: [what constitutes PASS]
Current context: [what you're verifying about]

Please run the command, report the actual output, and give a PASS or FAIL verdict.
Do not paraphrase. Do not assume. Run the command and show the output.
```

Example:
```
I need verification that the test suite passes. Here's what to verify:

Command to run: npm test
Success criteria: All tests pass with exit code 0
Current context: After fixing the authentication bug in src/auth.js

Please run the command, report the actual output, and give a PASS or FAIL verdict.
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

When you dispatch the verification subagent, these promises are ironclad:

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

The verification subagent is there for one reason: to make dishonesty impossible. Use it.

## Integration

**Called by (as REQUIRED sub-skill):**
- **hey-d:executing-plans** - Step 3, before handing off to finishing-a-development-branch
- **hey-d:subagent-driven-development** - After final reviewer, before finishing-a-development-branch

**Dispatches to:**
- **agents/verification.md** - The verification subagent that runs commands and reports truth

**Pairs with:**
- **hey-d:finishing-a-development-branch** - Runs immediately after this skill; finishing assumes verification has produced fresh evidence
