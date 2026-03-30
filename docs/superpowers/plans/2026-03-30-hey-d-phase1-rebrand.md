# hey-d Phase 1: Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the superpowers fork to `hey-d` — rename package, namespace all skills, delete/rename skills, update all cross-references.

**Architecture:** Find-and-replace `superpowers` → `hey-d` across all config/plugin files, then handle the two structural skill changes (delete `writing-skills`, rename `using-superpowers` → `lets-get-started`), then update all internal cross-references in skill content.

**Tech Stack:** Markdown, JSON, Bash, JavaScript (OpenCode plugin)

---

### Task 1: Update Package & Plugin Config Files

**Files:**
- Modify: `package.json`
- Modify: `gemini-extension.json`
- Modify: `.cursor-plugin/plugin.json`
- Modify: `.codex/INSTALL.md`
- Modify: `GEMINI.md`

- [ ] **Step 1: Update `package.json`**

Change name to `hey-d`, version to `1.0.0`, remove opencode main entry:

```json
{
  "name": "hey-d",
  "version": "1.0.0",
  "type": "module",
  "main": ".opencode/plugins/hey-d.js"
}
```

- [ ] **Step 2: Update `gemini-extension.json`**

```json
{
  "name": "hey-d",
  "description": "Core skills library: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "1.0.0",
  "contextFileName": "GEMINI.md"
}
```

- [ ] **Step 3: Update `.cursor-plugin/plugin.json`**

Replace all `superpowers` references:
- `"name": "hey-d"`
- `"displayName": "Hey D"`
- Remove `"homepage"` and `"repository"` lines pointing to obra/superpowers (or update to your repo)
- Remove `"commands": "./commands/"` line (commands directory is deleted)

- [ ] **Step 4: Update `.codex/INSTALL.md`**

Replace all occurrences of `superpowers` with `hey-d` throughout the file:
- Title: `# Installing Hey D for Codex`
- Clone URL: update to your repo
- Symlink paths: `~/.codex/hey-d`, `~/.agents/skills/hey-d`
- All instructions and verify commands

- [ ] **Step 5: Update `GEMINI.md`**

Change skill path references:
```
@./skills/lets-get-started/SKILL.md
@./skills/lets-get-started/references/gemini-tools.md
```

- [ ] **Step 6: Commit**

```bash
git add package.json gemini-extension.json .cursor-plugin/plugin.json .codex/INSTALL.md GEMINI.md
git commit -m "chore: rebrand package and plugin configs from superpowers to hey-d"
```

---

### Task 2: Delete `writing-skills` Skill

**Files:**
- Delete: `skills/writing-skills/` (entire directory)

- [ ] **Step 1: Delete the directory**

```bash
rm -rf skills/writing-skills/
```

- [ ] **Step 2: Commit**

```bash
git add -A skills/writing-skills/
git commit -m "chore: remove writing-skills skill"
```

---

### Task 3: Rename `using-superpowers` → `lets-get-started`

**Files:**
- Rename: `skills/using-superpowers/` → `skills/lets-get-started/`
- Modify: `skills/lets-get-started/SKILL.md` (frontmatter)

- [ ] **Step 1: Rename the directory**

```bash
mv skills/using-superpowers skills/lets-get-started
```

- [ ] **Step 2: Update SKILL.md frontmatter**

Change the `name` field in `skills/lets-get-started/SKILL.md`:

```yaml
---
name: lets-get-started
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---
```

- [ ] **Step 3: Update content inside SKILL.md**

Replace all occurrences of `superpowers` within the file:
- `Superpowers skills override` → `Hey-D skills override`
- `**Superpowers skills**` → `**Hey-D skills**`
- Any other `superpowers` references in the body text

- [ ] **Step 4: Update `references/codex-tools.md`**

Replace `superpowers:code-reviewer` → `hey-d:code-reviewer` and any other `superpowers` references in this file.

- [ ] **Step 5: Update `references/gemini-tools.md`**

Replace any `superpowers` references with `hey-d`.

- [ ] **Step 6: Commit**

```bash
git add skills/using-superpowers skills/lets-get-started
git commit -m "chore: rename using-superpowers skill to lets-get-started"
```

---

### Task 4: Update Cross-References in All Skill Files

**Files:**
- Modify: `skills/systematic-debugging/SKILL.md`
- Modify: `skills/executing-plans/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`
- Modify: `skills/requesting-code-review/SKILL.md`
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/code-quality-reviewer-prompt.md`
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/finishing-a-development-branch/SKILL.md`
- Modify: `skills/dispatching-parallel-agents/SKILL.md`
- Modify: `skills/verification-before-completion/SKILL.md`
- Modify: `skills/receiving-code-review/SKILL.md`
- Modify: `skills/test-driven-development/SKILL.md`
- Modify: `skills/using-git-worktrees/SKILL.md`

- [ ] **Step 1: Replace `superpowers:` with `hey-d:` in all skill SKILL.md files**

Run a global find-and-replace across all files in `skills/`:
- `superpowers:test-driven-development` → `hey-d:test-driven-development`
- `superpowers:verification-before-completion` → `hey-d:verification-before-completion`
- `superpowers:code-reviewer` → `hey-d:code-reviewer`
- `superpowers:subagent-driven-development` → `hey-d:subagent-driven-development`
- `superpowers:executing-plans` → `hey-d:executing-plans`
- `superpowers:finishing-a-development-branch` → `hey-d:finishing-a-development-branch`
- `superpowers:writing-plans` → `hey-d:writing-plans`
- `superpowers:using-git-worktrees` → `hey-d:using-git-worktrees`
- `superpowers:requesting-code-review` → `hey-d:requesting-code-review`
- All other `superpowers:` prefixed references

In short: replace all `superpowers:` → `hey-d:` across `skills/**/*.md`.

- [ ] **Step 2: Replace standalone "Superpowers" / "superpowers" text in skill files**

In skill content (not frontmatter), replace contextual mentions:
- `Superpowers works much better` → `Hey-D works much better`
- `superpowers skills` → `hey-d skills`
- Other prose references (use judgment — historical references in comments can stay)

- [ ] **Step 3: Update path references in writing-plans and brainstorming SKILL.md**

The writing-plans skill saves plans to `docs/superpowers/plans/`. Update to `docs/plans/`:
- In `skills/writing-plans/SKILL.md`: change `docs/superpowers/plans/` → `docs/plans/`

Also update the brainstorming skill:
- In `skills/brainstorming/SKILL.md`: change `docs/superpowers/specs/` → `docs/specs/`

- [ ] **Step 4: Verify no remaining `superpowers` references in skills**

```bash
grep -rn "superpowers" skills/ --include="*.md"
```

Expected: zero results.

- [ ] **Step 5: Commit**

```bash
git add skills/
git commit -m "chore: update all skill cross-references from superpowers to hey-d"
```

---

### Task 5: Update OpenCode Plugin

**Files:**
- Rename: `.opencode/plugins/superpowers.js` → `.opencode/plugins/hey-d.js`
- Modify: `.opencode/plugins/hey-d.js`
- Modify: `.opencode/INSTALL.md` (if exists)

- [ ] **Step 1: Rename the plugin file**

```bash
mv .opencode/plugins/superpowers.js .opencode/plugins/hey-d.js
```

- [ ] **Step 2: Update content in `hey-d.js`**

Replace all `superpowers` references:
- Top comment: `Superpowers plugin` → `Hey-D plugin`
- `SuperpowersPlugin` export → `HeyDPlugin`
- `superpowersSkillsDir` variable → `heyDSkillsDir`
- Skill path: `'using-superpowers'` → `'lets-get-started'`
- Bootstrap text: `superpowers:using-superpowers` → `hey-d:lets-get-started`
- `"You have superpowers"` → `"You have hey-d skills"`
- Skills location text: `superpowers/` → `hey-d/`
- Legacy check path: `~/.config/superpowers/skills` → remove or update
- Warning message: update `Superpowers` references to `Hey-D`

- [ ] **Step 3: Commit**

```bash
git add .opencode/plugins/
git commit -m "chore: rebrand opencode plugin from superpowers to hey-d"
```

---

### Task 6: Update Session-Start Hook

**Files:**
- Modify: `hooks/session-start`

- [ ] **Step 1: Update the hook script**

Replace all `superpowers` references:
- Comment: `SessionStart hook for superpowers plugin` → `SessionStart hook for hey-d plugin`
- Legacy skills dir: `~/.config/superpowers/skills` → remove this check entirely (not relevant for hey-d)
- Warning message: remove or update the legacy superpowers migration warning
- Skill path: `using-superpowers/SKILL.md` → `lets-get-started/SKILL.md`
- Bootstrap text: `superpowers:using-superpowers` → `hey-d:lets-get-started`
- `"You have superpowers"` → `"You have hey-d skills"`

- [ ] **Step 2: Verify hook runs successfully**

```bash
CLAUDE_PLUGIN_ROOT="$(pwd)" bash hooks/session-start
```

Expected: JSON output with `hookSpecificOutput.additionalContext` containing the hey-d bootstrap text. No `superpowers` string in output.

- [ ] **Step 3: Commit**

```bash
git add hooks/session-start
git commit -m "chore: rebrand session-start hook from superpowers to hey-d"
```

---

### Task 7: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/README.codex.md`
- Modify: `docs/README.opencode.md`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Rename: `docs/superpowers/` → `docs/hey-d/`

- [ ] **Step 1: Rename docs directory**

```bash
mv docs/superpowers docs/hey-d
```

- [ ] **Step 2: Update `README.md`**

Replace all `superpowers` references with `hey-d`:
- Title and description
- Remove `writing-skills` from the skills list
- Rename `using-superpowers` → `lets-get-started` in the skills list
- Update any installation/usage instructions

- [ ] **Step 3: Update `docs/README.codex.md`**

Replace `using-superpowers` → `lets-get-started` and `superpowers` → `hey-d` throughout.

- [ ] **Step 4: Update `docs/README.opencode.md`**

Replace `superpowers` → `hey-d` throughout.

- [ ] **Step 5: Update `.github/PULL_REQUEST_TEMPLATE.md`**

Remove or update the `superpowers:writing-skills` reference in the checklist.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/ .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs: rebrand documentation from superpowers to hey-d"
```

---

### Task 8: Update Test Files

**Files:**
- Modify: `tests/opencode/test-plugin-loading.sh`
- Modify: `tests/opencode/test-tools.sh`

- [ ] **Step 1: Update `tests/opencode/test-plugin-loading.sh`**

Replace:
- `using-superpowers` → `lets-get-started`
- `superpowers` → `hey-d` in all paths and messages

- [ ] **Step 2: Update `tests/opencode/test-tools.sh`**

Replace grep pattern:
- `superpowers:brainstorming\|superpowers:using-superpowers` → `hey-d:brainstorming\|hey-d:lets-get-started`

- [ ] **Step 3: Run tests to verify**

```bash
bash tests/opencode/test-plugin-loading.sh
bash tests/opencode/test-tools.sh
```

Expected: all tests pass (or fail for expected reasons like missing opencode).

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: update test files for hey-d rebrand"
```

---

### Task 9: Update Remaining Config Files

**Files:**
- Modify: `.claude-plugin/plugin.json` (if exists)
- Modify: `.claude-plugin/marketplace.json` (if exists)
- Modify: `.claude/settings.local.json`
- Modify: `agents/code-reviewer.md`

- [ ] **Step 1: Update `.claude-plugin/plugin.json`**

Replace `superpowers` → `hey-d`, update homepage/repository URLs.

- [ ] **Step 2: Update `.claude-plugin/marketplace.json`**

Replace `superpowers` → `hey-d`.

- [ ] **Step 3: Update `agents/code-reviewer.md`**

Replace any `superpowers` references with `hey-d`.

- [ ] **Step 4: Commit**

Note: `.claude/settings.local.json` is gitignored — update it manually if needed, but do not commit.

```bash
git add .claude-plugin/ agents/
git commit -m "chore: rebrand remaining config files from superpowers to hey-d"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Global grep for any remaining `superpowers` references**

```bash
grep -rn "superpowers" --include="*.md" --include="*.json" --include="*.js" --include="*.sh" . | grep -v node_modules | grep -v CHANGELOG.md | grep -v RELEASE-NOTES.md | grep -v docs/specs/ | grep -v docs/plans/
```

Expected: zero results (excluding changelog/release-notes which are historical, and the existing spec/plan docs which reference the migration itself).

- [ ] **Step 2: Verify hook still works**

```bash
CLAUDE_PLUGIN_ROOT="$(pwd)" bash hooks/session-start
```

Expected: clean JSON output with `hey-d` references, no `superpowers`.

- [ ] **Step 3: Verify no broken file references**

```bash
# Check that renamed files exist
test -d skills/lets-get-started && echo "OK: lets-get-started exists"
test -f skills/lets-get-started/SKILL.md && echo "OK: SKILL.md exists"
test -f .opencode/plugins/hey-d.js && echo "OK: hey-d.js exists"
test -d docs/hey-d && echo "OK: docs/hey-d exists"
# Check that old paths are gone
test ! -d skills/using-superpowers && echo "OK: using-superpowers removed"
test ! -d skills/writing-skills && echo "OK: writing-skills removed"
test ! -f .opencode/plugins/superpowers.js && echo "OK: superpowers.js removed"
```

Expected: all OK.

- [ ] **Step 4: Commit any final fixes**

If Step 1 found remaining references, fix them and commit:

```bash
git add -A
git commit -m "chore: fix remaining superpowers references"
```
