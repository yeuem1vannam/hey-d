# hey-d: Customized Skills Plugin

**Date:** 2026-03-30
**Status:** Draft
**Approach:** Progressive Fork (Phase 1 rebrand, Phase 2 customize iteratively)

## Overview

Fork of the `superpowers` v5.0.6 Claude Code plugin, rebranded as `hey-d` and customized for a multi-tool workflow targeting Claude Code, Gemini CLI, Cursor, and Codex. The name enables a natural invocation style: "Hey D, do X for me."

## Phase 1: Rebrand & Structure

### Package Identity

- `package.json`: name → `hey-d`, version → `1.0.0`
- `gemini-extension.json`: name → `hey-d`, description updated

### Skill Namespace

- All `superpowers:<name>` references become `hey-d:<name>` across all files
- Internal cross-references between skills updated (e.g., "invoke `hey-d:writing-plans`")

### Skill Changes

| Action | Skill |
|--------|-------|
| **Delete** | `writing-skills` |
| **Rename** | `using-superpowers` → `lets-get-started` (directory + frontmatter) |
| **Keep** | All other 12 skills (brainstorming, writing-plans, executing-plans, TDD, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, finishing-a-development-branch, using-git-worktrees, dispatching-parallel-agents, subagent-driven-development) |

### Commands

- Remove `commands/` directory entirely (already emptied)

### Multi-Tool Support

Update existing files — no new files needed:

- `.cursor-plugin/plugin.json` — rename `superpowers` → `hey-d`
- `.codex/INSTALL.md` — rename `superpowers` → `hey-d`
- `.opencode/` — rename `superpowers` → `hey-d`
- `GEMINI.md` — rename `superpowers` → `hey-d`
- `gemini-extension.json` — rename `superpowers` → `hey-d`

## Phase 2: Config Convention & Skill Customization

### Location

Config files live at `.agents/config/` in the consuming project root. Split by concern so skills only read what they need.

### Config Files

```
.agents/
  config/
    commits.md      # commit style, scopes
    github.md       # org-repo for template fallback, caching preferences
    code-style.md   # project-specific coding conventions
  cache/
    templates/      # cached PR/issue templates (gitignored)
```

### Behavior

- Skills check for the relevant `.agents/config/<topic>.md` file at the project root
- If absent, skills use sensible defaults (no error, no prompt)
- Config is tool-agnostic — works with Claude, Codex, Cursor, and Gemini

### Template Caching (PR & Issues)

1. Check `.github/` in the current workspace for templates
2. If not found, fetch from the org-level `.github` repo (configured in `.agents/config/github.md` via `org-repo` field)
3. Cache fetched templates to `.agents/cache/templates/`
4. `.agents/cache/` is gitignored

### Skill Customization (Priority Order)

### 1. Commit Workflow

- Reads `.agents/config/commits.md` for style (conventional commits) and valid scopes

### 2. PR Workflow

- Reads `.agents/config/github.md` for template lookup
- Template resolution: workspace `.github/` → org `.github` repo → cache

### 3. Issue Workflow

- Same template lookup logic as PR, but for issue templates

### 4. `lets-get-started` Skill

- Renamed from `using-superpowers`
- Skill discovery table updated with `hey-d:<name>` references
- Wording updated (no more "superpowers" language)

### Remaining Skills

Keep as-is with only namespace rename. Customize later based on real usage.

## Out of Scope

- No persona or tone changes
- No skill content trimming (defer to real usage feedback)
- No new skill files — commit/PR/issue are customizations of existing external skills
- No single `hey-d.config.md` file (replaced by `.agents/config/` split)
