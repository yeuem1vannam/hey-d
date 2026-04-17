---
name: revising-plans
description: Use mid-execution when a plan's reality diverges from what was written - classifies revision severity and handles amendment (agent-driven Medium) or escalation back to writing-plans/brainstorming (Major, requires user re-approval)
---

# Revising Plans

## Overview

Handle mid-flight plan revision. Called from `executing-plans` or `subagent-driven-development` when a task reveals the plan doesn't match reality.

**Core principle:** Classify severity → commit in-progress work → update the plan document (not just memory) → resume from amended task.

**Announce at start:** "I'm using the revising-plans skill to handle this mid-flight revision."

## Prerequisite
### Commit Config

Check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (commit types, scopes, co-author rules, pre-commit commands) when committing. If absent, use standard Conventional Commits defaults with no co-author attribution.

**Never include issue or PR references** (e.g. `#123`) in commit messages unless `.agents/config/commits.md` explicitly instructs it.

## When to Enter This Skill

Enter when, during execution, you discover:
- A task's approach won't work and affects subsequent tasks
- A requirement was missed or captured incorrectly
- The spec itself turns out to be wrong
- Later tasks depend on assumptions earlier tasks invalidated

**Do NOT enter for:**
- Typos or minor code issues within a task → fix in place, continue
- Failing tests due to implementation bugs → use `hey-d:systematic-debugging`
- Pre-existing bugs unrelated to the plan → note and continue (or file separately)

## Severity Classification

Classify before acting. Pick one:

### Medium — Plan is wrong, spec is right

Implementation approach needs to change; feature goals and spec remain valid.

Examples:
- Library chosen in plan doesn't support a required capability
- Task ordering creates a deadlock or forces rework
- A helper needs to be shared across more tasks than originally planned

→ Apply **Medium Protocol**. Agent-driven. No user confirmation.

### Major — Spec is wrong

Feature goals, requirements, or architecture from the spec are incorrect.

Examples:
- User reveals a requirement that wasn't captured
- Architecture fundamentally won't scale to the real use case
- Success criteria were ambiguous and the interpretation chosen was wrong

→ Apply **Major Protocol**. Requires user re-approval.

## Medium Protocol

1. **Commit in-progress work:**
   ```bash
   git add -A
   git commit -m "wip(<scope>): partial progress before plan revision"
   ```

2. **Amend the plan file** (`docs/plans/<filename>.md`):
   - Strike through obsolete tasks/steps with `~~text~~`
   - Add replacement tasks/steps with **full TDD structure** — same quality bar as `writing-plans`: exact file paths, complete code, exact commands with expected output
   - Keep task numbering continuous (e.g., obsolete Task 3 becomes ~~Task 3~~; new tasks become Task 3a, 3b)

3. **Add a Revision Log entry** at the bottom of the plan:
   ```markdown
   ## Revision Log

   ### YYYY-MM-DD — Medium revision: <one-line summary>
   - **Trigger:** what was discovered during execution
   - **Removed:** tasks/steps obsoleted
   - **Added:** replacement tasks/steps
   - **Resuming at:** Task N
   ```

4. **Commit the plan change:**
   ```bash
   git add docs/plans/<filename>.md
   git commit -m "docs(plans): amend <plan-name> for <short reason>"
   ```

5. **Announce** to the user (one short message):
   > "Mid-flight revision (Medium): [what changed and why]. Plan amended at `<path>`. Resuming at Task N."

6. **Return** to the calling skill at the amended task (e.g., `executing-plans` Step 2, not Step 1 — critical review is not needed since you just wrote the amendment).

## Major Protocol

1. **Commit in-progress work** (same as Medium Step 1).

2. **Add a Revision Log entry** noting the escalation:
   ```markdown
   ## Revision Log

   ### YYYY-MM-DD — Major revision: escalating to <writing-plans|brainstorming>
   - **Trigger:** what was discovered
   - **Scope of change:** why this exceeds plan-level amendment
   - **Handing to:** <skill name>
   ```

3. **Commit the log entry:**
   ```bash
   git add docs/plans/<filename>.md
   git commit -m "docs(plans): log major revision — handing to <skill>"
   ```

4. **STOP.** Hand back to the appropriate upstream skill:
   - **Plan is wrong but spec is right** → invoke `hey-d:writing-plans` to rewrite affected sections
   - **Spec itself is wrong** → invoke `hey-d:brainstorming` to rework the design

5. **Wait for user re-approval** of the revised plan/spec. Do not resume execution until user confirms.

6. **Return** to the calling skill at **Step 1** (re-read the revised plan from scratch — critical review IS needed for externally rewritten plans).

## Red Flags

**Never:**
- Silently change the plan without updating the document (memory-only drift is the bug this skill fixes)
- Skip the in-progress commit (loses context of what was attempted)
- Amend a plan for a Major change without user approval
- Treat a failing test as a revision trigger (that's `systematic-debugging`)
- Apply Major protocol for tweaks that fit Medium (over-escalation wastes user attention)
- Delete obsoleted tasks (strike through instead — history matters for audit)

**Always:**
- Commit in-progress work before revising
- Update the plan document, not just memory
- Log the revision: what, why, resumption point
- Match protocol tier to severity

## Integration

**Called by:**
- **hey-d:executing-plans** — when reality diverges during Step 2
- **hey-d:subagent-driven-development** — when an implementer subagent reports BLOCKED with plan-level concerns, or a reviewer surfaces a structural gap

**Calls (Major only):**
- **hey-d:writing-plans** — for plan-level rewrite
- **hey-d:brainstorming** — for spec-level rework

**Pairs with:**
- **hey-d:systematic-debugging** — use that skill first for failing tests; enter here only if the root cause is a plan defect, not a code defect
