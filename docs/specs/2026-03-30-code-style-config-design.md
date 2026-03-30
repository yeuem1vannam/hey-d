# hey-d: Code Style Config Customization

**Date:** 2026-03-30
**Status:** Draft
**Phase:** Phase 2 (first customization)

## Overview

Adds `.agents/config/code-style.md` support to hey-d. Four skills (TDD, brainstorming, executing-plans, subagent-driven-development) read this file at invocation time and apply its conventions throughout their execution — file naming, directory structure, component patterns, etc.

This is the first Phase 2 customization from the [hey-d customization design](2026-03-30-hey-d-customization-design.md).

## Config File Format

`.agents/config/code-style.md` lives at the consuming project root (not inside hey-d). It is free-form markdown — structured like a Cursor rules file, with sections and code examples. No required schema, no predefined headings. The AI reads and interprets it contextually.

### Example (React.js)

```markdown
## Naming conventions

### Components
- Files: PascalCase with `.tsx` extension
- Directory: `src/components/` (plural)
- Primary export matches file name

\```
// CORRECT
src/components/UserCard.tsx       → export function UserCard() {}
src/components/NavBar/index.tsx   → export function NavBar() {}

// WRONG
src/component/user-card.tsx
src/components/userCard.tsx
\```

### Hooks
- Files: `camelCase` prefixed with `use`, `.ts` extension
- Directory: `src/hooks/`

\```
// CORRECT
src/hooks/useAuth.ts
src/hooks/useLocalStorage.ts
\```
```

## Skill Instruction Block

Each of the 4 skills gets the following block added after the Overview section, before the main process:

```markdown
## Code Style Config

At the start of this skill, check if `.agents/config/code-style.md` exists in the
project root. If it does, read it and apply its conventions throughout this skill's
execution — file naming, directory structure, component patterns, etc.

If the file doesn't exist, proceed with no assumptions about code style.
```

The block is identical across all 4 skills. Placement before the main process ensures conventions are loaded before any file path or naming decisions are made.

## Behavior

- **Config present:** skill reads it, applies conventions for the duration of its execution
- **Config absent:** skill proceeds silently with no assumptions — no warning, no prompt
- **Scope:** conventions apply to code generation decisions within the skill (file names in TDD, file paths in brainstorming designs, etc.)

## Scope of Changes

### Modified in hey-d

| File | Change |
|------|--------|
| `skills/test-driven-development/SKILL.md` | Add instruction block |
| `skills/brainstorming/SKILL.md` | Add instruction block |
| `skills/executing-plans/SKILL.md` | Add instruction block |
| `skills/subagent-driven-development/SKILL.md` | Add instruction block |
| `example/.agents/config/code-style.md` | New — React.js reference example |

### Not changed

- `hooks/session-start` — no session-level injection needed
- `skills/lets-get-started/SKILL.md` — not a code-generating skill
- All other skills — out of scope

### In consuming projects (not hey-d)

- `.agents/config/code-style.md` — created by the user, gitignored or committed at their discretion

## Out of Scope

- Other `.agents/config/` files (commits.md, github.md) — separate features
- Validation or linting of the config file
- Injecting config via session-start hook
- Any changes to Gemini/Codex-specific files (conventions apply via skill reads, which work the same across tools)
