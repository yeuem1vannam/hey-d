# Code Style Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.agents/config/code-style.md` support to four skills (TDD, brainstorming, executing-plans, subagent-driven-development) by inserting a read-on-demand instruction block, plus ship a React.js example config.

**Architecture:** Each skill gets an identical `## Code Style Config` block inserted before its main process section. The block instructs the AI to read `.agents/config/code-style.md` at invocation time and apply conventions silently throughout execution. No code changes — markdown edits only.

**Tech Stack:** Markdown

---

### Task 1: Add instruction block to TDD skill

**Files:**
- Modify: `skills/test-driven-development/SKILL.md` (after line 15, before `## When to Use`)

The instruction block to insert:

```markdown
## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.
```

- [ ] **Step 1: Insert the block**

In `skills/test-driven-development/SKILL.md`, find:

```
**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use
```

Replace with:

```
**Violating the letter of the rules is violating the spirit of the rules.**

## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.

## When to Use
```

- [ ] **Step 2: Verify insertion**

```bash
grep -n "Code Style Config" skills/test-driven-development/SKILL.md
```

Expected: one match at a line number between 15 and 20.

- [ ] **Step 3: Commit**

```bash
git add skills/test-driven-development/SKILL.md
git commit -m "feat: add code-style config support to TDD skill"
```

---

### Task 2: Add instruction block to brainstorming skill

**Files:**
- Modify: `skills/brainstorming/SKILL.md` (after `## Anti-Pattern` section, before `## Checklist`)

- [ ] **Step 1: Insert the block**

In `skills/brainstorming/SKILL.md`, find:

```
"Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Checklist
```

Replace with:

```
"Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.

## Checklist
```

- [ ] **Step 2: Verify insertion**

```bash
grep -n "Code Style Config" skills/brainstorming/SKILL.md
```

Expected: one match between lines 18 and 25.

- [ ] **Step 3: Commit**

```bash
git add skills/brainstorming/SKILL.md
git commit -m "feat: add code-style config support to brainstorming skill"
```

---

### Task 3: Add instruction block to executing-plans skill

**Files:**
- Modify: `skills/executing-plans/SKILL.md` (after `## Overview`, before `## The Process`)

- [ ] **Step 1: Insert the block**

In `skills/executing-plans/SKILL.md`, find:

```
**Note:** Tell your human partner that Hey-D works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use hey-d:subagent-driven-development instead of this skill.

## The Process
```

Replace with:

```
**Note:** Tell your human partner that Hey-D works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use hey-d:subagent-driven-development instead of this skill.

## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.

## The Process
```

- [ ] **Step 2: Verify insertion**

```bash
grep -n "Code Style Config" skills/executing-plans/SKILL.md
```

Expected: one match between lines 14 and 20.

- [ ] **Step 3: Commit**

```bash
git add skills/executing-plans/SKILL.md
git commit -m "feat: add code-style config support to executing-plans skill"
```

---

### Task 4: Add instruction block to subagent-driven-development skill

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md` (after intro block, before `## When to Use`)

- [ ] **Step 1: Insert the block**

In `skills/subagent-driven-development/SKILL.md`, find:

```
**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## When to Use
```

Replace with:

```
**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.

## When to Use
```

- [ ] **Step 2: Verify insertion**

```bash
grep -n "Code Style Config" skills/subagent-driven-development/SKILL.md
```

Expected: one match between lines 12 and 18.

- [ ] **Step 3: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "feat: add code-style config support to subagent-driven-development skill"
```

---

### Task 5: Create React.js example config

**Files:**
- Create: `example/.agents/config/code-style.md`

- [ ] **Step 1: Create the directory and file**

Create `example/.agents/config/code-style.md` with:

```markdown
## Naming conventions

### Components
- Files: PascalCase with `.tsx` extension
- Directory: `src/components/` (plural)
- Primary named export matches the file name
- For multi-file components, use `ComponentName/index.tsx` and export only what is needed

\```
// CORRECT
src/components/UserCard.tsx        → export function UserCard() {}
src/components/NavBar/index.tsx    → export function NavBar() {}

// WRONG
src/component/user-card.tsx
src/components/userCard.tsx
src/components/user_card.tsx
\```

### Hooks
- Files: `camelCase` prefixed with `use`, `.ts` extension
- Directory: `src/hooks/`

\```
// CORRECT
src/hooks/useAuth.ts
src/hooks/useLocalStorage.ts

// WRONG
src/hooks/use-auth.ts
src/hooks/UseAuth.ts
\```

### Utilities and libs
- Files: `camelCase` with `.ts` extension
- Directory: `src/lib/` or `src/utils/`

\```
// CORRECT
src/lib/formatDate.ts
src/utils/parseQuery.ts
\```

### Types
- Files: `camelCase` with `.ts` extension
- Directory: `src/types/`

\```
// CORRECT
src/types/user.ts
src/types/apiResponse.ts
\```
```

- [ ] **Step 2: Verify file exists**

```bash
test -f example/.agents/config/code-style.md && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add example/.agents/config/code-style.md
git commit -m "docs: add React.js example code-style config"
```

---

### Task 6: Migrate docs from `docs/hey-d/` to flat structure

**Files:**
- Move: `docs/hey-d/specs/*.md` → `docs/specs/`
- Move: `docs/hey-d/plans/*.md` → `docs/plans/`
- Modify: `docs/specs/2026-03-30-code-style-config-design.md` (fix internal cross-reference)
- Delete: `docs/hey-d/` (now empty)

The skills (brainstorming, writing-plans) direct output to `docs/specs/` and `docs/plans/`.
The `docs/hey-d/` directory is a leftover from the phase 1 rename of `docs/superpowers/` and should be removed.

- [ ] **Step 1: Create target directories and move specs**

```bash
mkdir -p docs/specs
git mv docs/hey-d/specs/2026-01-22-document-review-system-design.md docs/specs/
git mv docs/hey-d/specs/2026-02-19-visual-brainstorming-refactor-design.md docs/specs/
git mv docs/hey-d/specs/2026-03-11-zero-dep-brainstorm-server-design.md docs/specs/
git mv docs/hey-d/specs/2026-03-23-codex-app-compatibility-design.md docs/specs/
git mv docs/hey-d/specs/2026-03-30-hey-d-customization-design.md docs/specs/
git mv docs/hey-d/specs/2026-03-30-code-style-config-design.md docs/specs/
```

- [ ] **Step 2: Move plans**

```bash
git mv docs/hey-d/plans/2026-01-22-document-review-system.md docs/plans/
git mv docs/hey-d/plans/2026-02-19-visual-brainstorming-refactor.md docs/plans/
git mv docs/hey-d/plans/2026-03-11-zero-dep-brainstorm-server.md docs/plans/
git mv docs/hey-d/plans/2026-03-23-codex-app-compatibility.md docs/plans/
git mv docs/hey-d/plans/2026-03-30-hey-d-phase1-rebrand.md docs/plans/
git mv docs/hey-d/plans/2026-03-30-code-style-config.md docs/plans/
```

Note: this plan file itself is being moved in this step. After running `git mv`, continue editing at the new path `docs/plans/2026-03-30-code-style-config.md`.

- [ ] **Step 3: Fix cross-reference in code-style-config design**

In `docs/specs/2026-03-30-code-style-config-design.md`, find:

```
This is the first Phase 2 customization from the [hey-d customization design](2026-03-30-hey-d-customization-design.md).
```

The relative link still works since both files are now in `docs/specs/`. No change needed — verify by reading the file:

```bash
grep "hey-d customization design" docs/specs/2026-03-30-code-style-config-design.md
```

Expected: link points to `2026-03-30-hey-d-customization-design.md` (relative, same directory — correct).

- [ ] **Step 4: Remove empty docs/hey-d/ directory**

```bash
rmdir docs/hey-d/specs docs/hey-d/plans docs/hey-d
```

Expected: no output (directories removed cleanly).

- [ ] **Step 5: Verify structure**

```bash
ls docs/specs/
ls docs/plans/
test ! -d docs/hey-d && echo "OK: docs/hey-d removed"
```

Expected: all 6 spec files in `docs/specs/`, all 9 plan files in `docs/plans/`, `docs/hey-d` gone.

- [ ] **Step 6: Commit**

```bash
git add -A docs/
git commit -m "chore: migrate docs from docs/hey-d/ to docs/specs/ and docs/plans/"
```

---

### Task 8: Final verification

- [ ] **Step 1: Confirm all 4 skills have the block**

```bash
grep -rn "Code Style Config" skills/
```

Expected: exactly 4 matches, one in each of:
- `skills/test-driven-development/SKILL.md`
- `skills/brainstorming/SKILL.md`
- `skills/executing-plans/SKILL.md`
- `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 2: Confirm example file is well-formed**

```bash
cat example/.agents/config/code-style.md
```

Expected: renders cleanly, shows React component naming conventions.

- [ ] **Step 3: Confirm no other skills were accidentally modified**

```bash
grep -rn "Code Style Config" skills/ | wc -l
```

Expected: `4`
