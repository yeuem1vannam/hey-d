# hey-d: Commit & PR Config Support

**Date:** 2026-03-31
**Status:** Draft
**Approach:** Config-only (no new skill files) — follows the `code-style.md` pattern

## Overview

Add commit and PR convention customization to hey-d via config files at `.agents/config/`. Workflow skills that produce or plan commits read `.agents/config/commits.md`; skills that create PRs read `.agents/config/github.md`. No dedicated `commit` or `pr` skills are added — config is applied inline by each workflow skill.

The global `~/.claude/skills/commit/` and `~/.claude/skills/pr/` skills are removed by the user as a one-time migration. Standalone `/commit` invocation goes away entirely; commits are handled by workflow skills using the project config.

## Config Files

Config files live at `.agents/config/` in the consuming project root. They are not shipped with hey-d — users create them per project.

### `.agents/config/commits.md`

Documents project-specific commit conventions. Skills use this to apply the right types, scopes, co-author rules, and pre-commit commands. Suggested fields:

- **Commit types** — allowed types and their meanings (e.g. `feat`, `fix`, `chore`)
- **Scopes** — valid scope values for this project (e.g. package names, domain areas)
- **Co-author rules** — whether to include AI attribution, which email to use
- **Pre-commit commands** — test or format commands to run before committing

If absent, skills fall back to standard Conventional Commits with no scope restrictions and no co-author attribution.

### `.agents/config/github.md`

Documents project-specific GitHub/PR conventions. Skills use this for template resolution and PR formatting. Suggested fields:

- **org-repo** — the org-level `.github` repo for template fallback (e.g. `my-org/.github`)
- **PR title format** — convention for PR titles (defaults to commit convention if absent)
- **Caching preferences** — whether to cache fetched templates to `.agents/cache/templates/`

If absent, skills look for templates only in the workspace `.github/` directory and use standard PR formatting.

## Skills Updated

Each affected skill gets a standard config-loading block at its top, identical in form to the `code-style.md` pattern already established in hey-d.

### Commit config block

Added to: `finishing-a-development-branch`, `executing-plans`, `subagent-driven-development`, `writing-plans`

> At the start of this skill, check if `.agents/config/commits.md` exists in the project root. If it does, read it and apply its conventions (types, scopes, co-author rules, pre-commit commands). If absent, use standard Conventional Commits defaults with no co-author attribution.

### PR config block

Added to: `finishing-a-development-branch`

> At the start of this skill, check if `.agents/config/github.md` exists in the project root. If it does, read it and apply its conventions (PR template resolution, title format). If absent, look for templates only in the workspace `.github/` directory.

## Template Resolution Order (PR)

1. Check `.github/` in the current workspace
2. If not found and `org-repo` is set in `.agents/config/github.md`, fetch from that repo
3. Cache fetched templates to `.agents/cache/templates/` (`.agents/cache/` is gitignored)

## Migration

User performs these steps once before using hey-d's commit/PR config support:

```bash
rm -rf ~/.claude/skills/commit/
rm -rf ~/.claude/skills/pr/
```

After removal, workflow skills handle all commit and PR operations directly.

## Out of Scope

- No dedicated `commit` or `pr` skill files in hey-d
- No install script for migration
- No standalone `/commit` command replacement
- No changes to `issue` skill (no config needed at this stage)
