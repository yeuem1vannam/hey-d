# hey-d: Verification Subagent

**Date:** 2026-04-17
**Status:** Draft
**Approach:** Named subagent (`agents/completion-verifier.md`) dispatched by `verification-before-completion` skill

## Overview

Today, `verification-before-completion` is a rules document: it tells the main agent to run tests, parse output, and check requirements. The main agent (Opus-tier) ends up watching raw test output scroll through its context and re-reading plan files to check coverage. That's mechanical work that Haiku/Sonnet handles fine, and the raw test output is pure context pollution.

Move this work to a dedicated subagent. The skill's role changes from "follow these rules" to "dispatch this subagent and act on its report." Main agent context stays clean; verification runs cheaper; the evidence rule still holds because the subagent is required to run commands before reporting.

## Agent Definition

**File:** `agents/completion-verifier.md`

**Model:** `sonnet` (running commands and counting test results is mechanical, but requirement-to-code matching often involves semantic reasoning — "does this code satisfy 'handles empty input'?" — where Haiku's false-negative/false-positive rate is too high for the last-gate role this agent plays)

**Role description (for frontmatter):** "Use this agent to gather evidence that a task or plan is actually complete — it runs verification commands, parses output, and checks plan requirements line-by-line against the code. Returns a structured report. Never trust a completion claim that didn't go through this agent."

**System prompt summary:**

- You gather verification evidence. You do not fix issues, make decisions, or editorialize.
- Run exactly the commands you are given. Do not improvise.
- Read the full output including exit code.
- Check each listed requirement against the cited files.
- Report structured results. Never claim something you did not verify.

## Inputs

The dispatching skill passes the subagent:

- **Verification commands** — list of commands to run in order (e.g., `pnpm test`, `pnpm typecheck`, `pnpm lint`). Caller decides which apply.
- **Plan or requirements source** — path to the plan file, or an inline list of requirements to verify.
- **Changed files** — list of files modified during the work being verified (so the agent knows where to look for requirement coverage).
- **Working directory** — where to run commands from.

## Outputs

Structured report with these sections:

```
STATUS: PASS | FAIL | PARTIAL

TEST RESULTS:
  - <command>: <passed>/<total> (exit code <N>)
  - <command>: <passed>/<total> (exit code <N>)

REQUIREMENTS:
  - [✓] <requirement> — covered by <file:lines>
  - [✓] <requirement> — covered by <file:lines>
  - [✗] <requirement> — no code evidence found

FAILURES:
  - <test name>: <short failure reason>
  - <command> exit <code>: <first error line>

CONFIDENCE NOTES:
  - <anything ambiguous or worth flagging>
```

- `PASS`: all commands exit 0 AND every requirement has evidence
- `FAIL`: any command fails OR any requirement lacks evidence
- `PARTIAL`: tests pass but requirements have gaps (or vice versa)

## Integration

### `skills/verification-before-completion/SKILL.md`

Restructured from a rules document into a dispatch protocol:

1. Identify verification commands (from project config or caller)
2. Identify requirements (from plan or inline list)
3. Dispatch the completion-verifier subagent with the inputs above
4. Read the report
5. If `PASS`: proceed
6. If `FAIL` or `PARTIAL`: STOP, return findings to caller

The "iron law" and "gate function" wording stays — they're now the subagent's contract, not the main agent's.

### Callers (unchanged at their level)

- `hey-d:executing-plans` Step 3 — still says "use hey-d:verification-before-completion"
- `hey-d:subagent-driven-development` — still says "use hey-d:verification-before-completion" before finishing

Neither caller needs to know the internal dispatch happens. The skill-level contract is preserved.

## Edge Cases

- **No test command in project:** Subagent reports `STATUS: PARTIAL`, notes absence, still verifies requirements.
- **Test command hangs:** Subagent is given a timeout. On timeout, reports `STATUS: FAIL` with reason "timeout after Ns".
- **Requirement ambiguous:** Subagent marks `[?]` instead of `[✓]`/`[✗]`, adds note in CONFIDENCE NOTES. Caller treats `[?]` as `PARTIAL`.
- **Changed file list missing:** Subagent can still run tests; requirement-coverage check is best-effort against git diff vs base branch.
- **Test output exceeds subagent context:** Subagent reports summary stats and first N failures; truncation is explicit in the report.

## Out of Scope

- Running any fix for failures (caller decides)
- Selecting which tests to run (caller passes the command)
- CI-system-specific integration (e.g., parsing JUnit XML) — subagent parses human-readable output only
- Retrying flaky tests — first result stands; flakiness is flagged in CONFIDENCE NOTES

## Implementation Notes

- The subagent's system prompt must include the "fresh evidence only" rule from the current `verification-before-completion/SKILL.md`. This is its core contract.
- The subagent should refuse to report `PASS` without having actually run the commands — if commands were given but skipped for any reason, status is `FAIL` with reason "verification not executed".
- Commands run sequentially, not in parallel — test output is easier to parse in order and failures shouldn't mask each other.
