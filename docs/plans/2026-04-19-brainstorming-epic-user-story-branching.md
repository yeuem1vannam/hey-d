# Brainstorming Epic / User Story Branching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Epic and User Story brainstorming modes to `skills/brainstorming`, dispatched by user phrasing, producing lighter specs plus GitHub issue + branch side effects. Task mode unchanged.

**Architecture:** SKILL.md detects the mode from the user's opening message and either proceeds with the existing Task flow (default) or loads one of two new companion files (`epic-flow.md`, `user-story-flow.md`) that own their respective checklists end-to-end. Flow files own issue + branch + push mechanics; SKILL.md stays the shared dispatcher.

**Tech Stack:** Markdown-only changes to the `hey-d` plugin's brainstorming skill and `.agents/config/branches.md`. `gh` CLI for issue ops. Git for branch + commit + push. No runtime code, no new tests beyond structural grep checks described inside each task.

**Spec:** [docs/specs/2026-04-19-brainstorming-epic-user-story-branching-design.md](../specs/2026-04-19-brainstorming-epic-user-story-branching-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `.agents/config/branches.md` | Modify | Add `epic/` and `us/` as valid prefixes alongside commit-type prefixes. |
| `skills/brainstorming/epic-flow.md` | Create | End-to-end Epic brainstorm checklist: clarify → spec → issue → branch → push → decompose. |
| `skills/brainstorming/user-story-flow.md` | Create | End-to-end User Story brainstorm checklist. Supports `parent=epic/<N>` context. |
| `skills/brainstorming/SKILL.md` | Modify | Add Mode Detection section that dispatches to flow files. Update frontmatter description. |

Task order: config → Epic flow → US flow → SKILL.md dispatcher. Each task is self-contained and produces a commit.

---

## Task 1: Extend branches config to allow `epic/` and `us/` prefixes

**Files:**
- Modify: `.agents/config/branches.md`

- [ ] **Step 1: Verify current state (failing check)**

Run:
```bash
grep -E "^- \`epic\`" .agents/config/branches.md || echo "NOT FOUND"
grep -E "^- \`us\`" .agents/config/branches.md || echo "NOT FOUND"
```
Expected: both print `NOT FOUND`.

- [ ] **Step 2: Rewrite `.agents/config/branches.md`**

Replace the entire file with the following content (the outer fence uses four backticks so that the inner triple-backtick code blocks are preserved verbatim in the file):

````markdown
# Branch Naming

## Format

```
<type>/<issue-number>-<keyword>
```

- `<type>` is one of:
  - Commit types: `feat`, `fix`, `tweak`, `docs`, `test`, `chore`, `perf`, `refactor`, `infra`, `lint`, `revert`
  - Planning-level types (for `hey-d:brainstorming` Epic / User Story flows): `epic`, `us`
- `<issue-number>` is the GitHub issue number (omit if no issue exists, except for `epic/` and `us/` where an issue is always created)
- `<keyword>` is 1-2 lowercase keywords separated by hyphens

## Examples

```
feat/42-user-auth
fix/118-null-payload
refactor/205-cache
docs/89-api-guide
chore/300-deps
feat/onboarding          # no issue number
epic/501-billing-rewrite
us/512-invoice-export
```

## Validation

Before creating a branch, verify the name matches `<type>/<number>-<keyword>` or `<type>/<keyword>`. Reject names that use other separators (underscores, camelCase) or skip the type prefix.
````

- [ ] **Step 3: Verify the new content is present**

Run:
```bash
grep -E "Planning-level types" .agents/config/branches.md
grep -E "^\`\`\`" .agents/config/branches.md | wc -l
grep -E "epic/501-billing-rewrite" .agents/config/branches.md
grep -E "us/512-invoice-export" .agents/config/branches.md
```
Expected: first and third and fourth grep each print one matching line; the code-fence count line prints `4`.

- [ ] **Step 4: Commit**

```bash
git add .agents/config/branches.md
git commit -m "docs(agents): allow epic/ and us/ branch prefixes" \
  -m "Extends the branch-naming convention so planning-level brainstorming flows can create epic/<N>-<slug> and us/<N>-<slug> branches alongside the existing commit-type prefixes." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 2: Create `epic-flow.md`

**Files:**
- Create: `skills/brainstorming/epic-flow.md`

- [ ] **Step 1: Verify the file does not yet exist**

Run:
```bash
test ! -f skills/brainstorming/epic-flow.md && echo OK
```
Expected: `OK`.

- [ ] **Step 2: Create `skills/brainstorming/epic-flow.md`**

Write this exact content:

````markdown
# Brainstorming: Epic Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares an Epic brainstorm (e.g., "brainstorm an epic…", "this is an Epic…", "EPIC:…").
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## Shared prerequisites

Run these before starting the Epic-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present, following the same rule described in SKILL.md.
2. **Commit Config** — read `.agents/config/commit.md` if present. Spec commit uses `docs(brainstorming): add epic spec for <name>` by default.
3. **Branches Config** — read `.agents/config/branches.md` if present. Epic branch uses the `epic/<N>-<keyword>` prefix defined there.
4. **Visual Companion** — if upcoming questions will involve visual content, offer the companion per the rule in SKILL.md (its own message, no other content).

## Checklist

Create a TodoWrite task for each item and complete them in order:

1. Explore project context (files, docs, recent commits)
2. Ask clarifying questions one at a time (purpose, stakeholders, constraints, success criteria)
3. Propose 2–3 approaches with trade-offs and a recommendation
4. Present the spec sections below one at a time with approval gates
5. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-epic.md`
6. Spec self-review (placeholder / consistency / scope / ambiguity) — fix inline
7. User reviews the spec file; wait for approval
8. Confirm and create the GitHub Epic issue
9. Create the `epic/<N>-<slug>` branch, commit the spec, push
10. Offer decomposition into Candidate User Stories

## Spec sections

Present each to the user and confirm before moving on. Scale the prose to the idea's complexity; the whole Epic spec should read in under five minutes.

- **Goal / Problem** — outcome this Epic unlocks and why it matters now.
- **Stakeholders** — who asked for this, who is affected, who reviews.
- **Success Criteria** — outcome-level (user behaviour, business metric), not feature-level.
- **Scope** — `In` and `Out` bullet lists.
- **Technical Notes** — constraints, integration points, dependencies. No designs, no code. A few sentences to a short paragraph.
- **Reference** — related issues, PRs, documents. Include `Part of #<parent_issue>` if relevant.
- **Candidate User Stories** — bullet list of stories that likely decompose from this Epic. Seed for decomposition; not contractual. **Stripped from the issue body.**
- **Open Questions** — unresolved items. **Stripped from the issue body.**

## Spec file

- Path: `docs/specs/YYYY-MM-DD-<slug>-epic.md` where `<slug>` is kebab-cased 2–4 keywords from the Epic name.
- Slug generation: lowercase the Epic name, replace non-alphanumerics with hyphens, collapse repeats, trim to at most four hyphen-separated words.

## Issue creation (requires explicit user confirmation)

Before running `gh issue create`, present a preview:

> Ready to create the GitHub Epic issue with:
> - **Title:** `EPIC: <name>`
> - **Labels:** `Type:Epic`
> - **Body:** (all spec sections except Candidate User Stories and Open Questions)
>
> Proceed? (yes / edit / cancel)

Only run `gh issue create` on `yes`. On `edit`, take the user's changes and re-show the preview.

**Creating the label if missing.** Before `gh issue create`, check for the label and create it if absent:

```bash
if ! gh label list --json name --jq '.[].name' | grep -q '^Type:Epic$'; then
  gh label create "Type:Epic" --color "#8B5CF6" --description "Epic-level planning issue"
fi
```

**Creating the issue.** Use a body file written from the spec (sections filtered):

```bash
# BODY_FILE is a temp file containing spec sections minus Candidate User Stories and Open Questions
gh issue create \
  --title "EPIC: <name>" \
  --label "Type:Epic" \
  --body-file "$BODY_FILE"
```

Capture the issue URL or number from the output — it is needed for the branch name.

## Branch + commit + push (requires explicit user confirmation)

Before running `git push`, present:

> Ready to create and push branch `epic/<N>-<slug>` (base `main`) with the spec committed.
>
> Proceed? (yes / cancel)

On `yes`:

```bash
# Ensure working tree is clean before switching branches
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash before proceeding." >&2
  exit 1
fi

git fetch origin main
git checkout -b "epic/<N>-<slug>" origin/main
git add "docs/specs/YYYY-MM-DD-<slug>-epic.md"
git commit -m "docs(brainstorming): add epic spec for <name>" \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
git push -u origin "epic/<N>-<slug>"
```

## Decomposition offer

After the push succeeds, present the Candidate User Stories list with numbers:

> Epic branch and issue created. Candidate User Stories from the spec:
>
> 1. <first candidate>
> 2. <second candidate>
> 3. <...>
>
> Brainstorm any of these now? (number / `stop`)

If the user picks a number, invoke `skills/brainstorming/user-story-flow.md` with context `parent=epic/<N>` and `parent_issue=<N>`. If the user says `stop`, exit the skill.

## Edge cases

- **`gh` not authenticated or offline.** Surface the error, ask the user whether to retry or abort. The spec file remains on disk; re-running the flow can resume from the issue-create step.
- **Dirty working tree.** Refuse `git checkout -b`; ask the user to commit or stash first.
- **`Type:Epic` label creation fails.** Report the error, abort the issue-create step; ask the user to create the label manually and retry.
- **User aborts at the decomposition offer.** Exit cleanly. Spec, issue, and branch remain.
````

- [ ] **Step 3: Verify required sections are present**

Run:
```bash
grep -c "^## Checklist" skills/brainstorming/epic-flow.md
grep -c "^## Spec sections" skills/brainstorming/epic-flow.md
grep -c "^## Issue creation" skills/brainstorming/epic-flow.md
grep -c "^## Branch + commit + push" skills/brainstorming/epic-flow.md
grep -c "^## Decomposition offer" skills/brainstorming/epic-flow.md
grep -c "epic/<N>-<slug>" skills/brainstorming/epic-flow.md
grep -c "EPIC: <name>" skills/brainstorming/epic-flow.md
grep -c "Type:Epic" skills/brainstorming/epic-flow.md
```
Expected: every line prints `1` or greater.

- [ ] **Step 4: Commit**

```bash
git add skills/brainstorming/epic-flow.md
git commit -m "feat(brainstorming): add epic-mode flow" \
  -m "New companion file loaded by SKILL.md when the user explicitly declares an Epic brainstorm. Owns spec template, GitHub issue creation, epic/<N>-<slug> branch creation and push, and User Story decomposition offer." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 3: Create `user-story-flow.md`

**Files:**
- Create: `skills/brainstorming/user-story-flow.md`

- [ ] **Step 1: Verify the file does not yet exist**

Run:
```bash
test ! -f skills/brainstorming/user-story-flow.md && echo OK
```
Expected: `OK`.

- [ ] **Step 2: Create `skills/brainstorming/user-story-flow.md`**

Write this exact content:

````markdown
# Brainstorming: User Story Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares a User Story brainstorm (e.g., "brainstorm a user story…", "this is a US…", "US:…"), OR when loaded from `epic-flow.md`'s decomposition offer with a `parent=epic/<N>` context.
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## Parent context

If invoked with `parent=epic/<N>` and `parent_issue=<N>`, record those values; they drive:

- The spec's `Reference` section, which begins with `Part of #<N>`.
- The issue body, which begins with `Part of #<N>`.
- The branch base: `us/<M>-<slug>` branches from `epic/<N>-<epic-slug>` instead of `main`.

If invoked standalone (no parent), base = `main`.

## Shared prerequisites

Run these before starting the US-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present.
2. **Commit Config** — read `.agents/config/commit.md` if present. Spec commit uses `docs(brainstorming): add user story spec for <name>` by default.
3. **Branches Config** — read `.agents/config/branches.md` if present. US branch uses the `us/<N>-<keyword>` prefix defined there.
4. **Visual Companion** — if upcoming questions involve visual content, offer the companion per the rule in SKILL.md.

## Checklist

Create a TodoWrite task for each item:

1. Explore project context
2. Ask clarifying questions one at a time (actor, goal, benefit, scenario, DoD)
3. Propose 2–3 approaches with trade-offs
4. Present the spec sections below one at a time with approval gates
5. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-story.md`
6. Spec self-review — fix inline
7. User reviews the spec file; wait for approval
8. Confirm and create the GitHub User Story issue (two steps: create, then `gh issue edit` to insert the issue number into the title)
9. Create the `us/<N>-<slug>` branch (base = parent Epic branch or `main`), commit the spec, push
10. Offer decomposition into Candidate Tasks

## Spec sections

Mirrors the `botfi/.github` User Story issue template, plus two appended working-notes sections that are stripped from the issue body.

- **User Story** — `As <role>, I want to <goal>, so that <benefit>`.
- **Scenario** — step-by-step actor journey. Use the template's `#### A. …` / `#### B. …` heading style.
- **Definition of Done** — checklist. At least one checkbox item.
- **UI** *(optional)* — mocks or notes; omit the section entirely if not applicable.
- **Table Definition** *(optional)* — DB shape; omit if not applicable.
- **Implementation** — light technical notes; enough to scope, not to implement. A few bullets.
- **Reference** — related issues, PRs, documents. If `parent=epic/<N>`, begins with `Part of #<N>`.
- **Candidate Tasks** — bullet list of tasks. **Stripped from the issue body.**
- **Open Questions** — unresolved items. **Stripped from the issue body.**

## Spec file

- Path: `docs/specs/YYYY-MM-DD-<slug>-story.md`.
- Slug generation rule is identical to the Epic flow (lowercase, non-alphanumerics → hyphens, collapsed, trimmed to ≤4 words).

## Issue creation (requires explicit user confirmation)

Present a preview:

> Ready to create the GitHub User Story issue with:
> - **Title (pre-create placeholder):** `[US] <name>`
> - **Title (after issue number is known):** `[US-<N>] <name>`
> - **Labels:** `Type:UserStory`
> - **Body:** (all spec sections except Candidate Tasks and Open Questions, with `Part of #<N>` at the top if a parent Epic exists)
>
> Proceed? (yes / edit / cancel)

On `yes`:

```bash
# Step 1 — create the issue with the placeholder title
issue_url=$(gh issue create \
  --title "[US] <name>" \
  --label "Type:UserStory" \
  --body-file "$BODY_FILE")

# Step 2 — capture N and finalize the title
issue_number="${issue_url##*/}"
gh issue edit "$issue_number" --title "[US-$issue_number] <name>"
```

The `Type:UserStory` label already exists in `botfi/.github`, so no label-create step is needed. If the target repo does not have the label, create it:

```bash
if ! gh label list --json name --jq '.[].name' | grep -q '^Type:UserStory$'; then
  gh label create "Type:UserStory" --color "#3B82F6" --description "User Story planning issue"
fi
```

## Branch + commit + push (requires explicit user confirmation)

Base branch depends on context:

- **Decomposed from Epic:** base = `epic/<parent_N>-<epic-slug>`. If that branch was deleted locally, fetch it from origin; if it is also missing on origin, fall back to `main` and warn in the preview.
- **Standalone:** base = `main`.

Preview:

> Ready to create and push branch `us/<N>-<slug>` (base `<base>`) with the spec committed.
>
> Proceed? (yes / cancel)

On `yes`:

```bash
# Ensure working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash before proceeding." >&2
  exit 1
fi

# Resolve base: base_branch is either the parent Epic's branch name
# ("epic/<parent_N>-<epic-slug>") or "main"
base_branch="<base_branch>"
git fetch origin "$base_branch"
git checkout -b "us/<N>-<slug>" "origin/$base_branch"
git add "docs/specs/YYYY-MM-DD-<slug>-story.md"
git commit -m "docs(brainstorming): add user story spec for <name>" \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
git push -u origin "us/<N>-<slug>"
```

## Decomposition offer

After push succeeds, present the Candidate Tasks list with numbers:

> User Story branch and issue created. Candidate Tasks from the spec:
>
> 1. <first candidate>
> 2. <...>
>
> Brainstorm any of these now? (number / `stop`)

If the user picks a number, invoke the **existing Task flow in `SKILL.md`** (the Task flow is the default; simply continue into it with the candidate as the seed request). Pre-seed the Task spec's Reference section with `Part of #<story_issue>` (and `Part of #<epic_issue>` if applicable). No issue or branch is created by brainstorming for the Task — `hey-d:using-git-worktrees` and `hey-d:writing-plans` own that downstream.

If the user says `stop`, exit the skill.

## Edge cases

- **Parent Epic branch was force-deleted everywhere.** Fall back to `main`; warn in the preview and include a note in the Reference section explaining the fallback.
- **`gh` not authenticated.** Surface the error; spec remains on disk.
- **Dirty working tree.** Refuse `git checkout -b`.
- **`gh issue edit` fails after the issue was created.** The issue exists with placeholder title. Retry `gh issue edit` or instruct the user to rename manually.
````

- [ ] **Step 3: Verify required sections are present**

Run:
```bash
grep -c "^## Parent context" skills/brainstorming/user-story-flow.md
grep -c "^## Checklist" skills/brainstorming/user-story-flow.md
grep -c "^## Spec sections" skills/brainstorming/user-story-flow.md
grep -c "^## Issue creation" skills/brainstorming/user-story-flow.md
grep -c "^## Branch + commit + push" skills/brainstorming/user-story-flow.md
grep -c "^## Decomposition offer" skills/brainstorming/user-story-flow.md
grep -c "us/<N>-<slug>" skills/brainstorming/user-story-flow.md
grep -c "\[US-<N>\]" skills/brainstorming/user-story-flow.md
grep -c "Type:UserStory" skills/brainstorming/user-story-flow.md
grep -c "gh issue edit" skills/brainstorming/user-story-flow.md
```
Expected: every line prints `1` or greater.

- [ ] **Step 4: Commit**

```bash
git add skills/brainstorming/user-story-flow.md
git commit -m "feat(brainstorming): add user-story-mode flow" \
  -m "New companion file loaded by SKILL.md when the user declares a User Story brainstorm, or when dispatched from epic-flow.md with a parent Epic context. Owns spec template (mirrors botfi template), GitHub issue creation with post-create title finalize, us/<N>-<slug> branch creation with parent-branch stacking, and Task decomposition offer." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 4: Add Mode Detection dispatcher to SKILL.md and update frontmatter description

**Files:**
- Modify: `skills/brainstorming/SKILL.md`

- [ ] **Step 1: Verify current state**

Run:
```bash
grep -c "^## Mode Detection" skills/brainstorming/SKILL.md
grep -c "epic-flow.md" skills/brainstorming/SKILL.md
grep -c "user-story-flow.md" skills/brainstorming/SKILL.md
```
Expected: every line prints `0`.

- [ ] **Step 2: Update the frontmatter description**

Read `skills/brainstorming/SKILL.md` and replace its existing frontmatter `description` line:

```
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
```

with:

```
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Supports three modes: Task (default, produces an implementation plan), User Story (triggered by 'US:' or 'brainstorm a user story', produces a spec + GitHub issue + us/<N> branch), and Epic (triggered by 'EPIC:' or 'brainstorm an epic', produces a spec + GitHub issue + epic/<N> branch)."
```

- [ ] **Step 3: Insert the Mode Detection section**

Use the Edit tool on `skills/brainstorming/SKILL.md`. The file currently transitions from the Code Style Config block into the Checklist like this:

```
If the file doesn't exist, proceed with no assumptions about code style.

## Checklist
```

Replace that `old_string`:

```
If the file doesn't exist, proceed with no assumptions about code style.

## Checklist
```

with this `new_string` (the Mode Detection block inserted between the two existing pieces):

````markdown
If the file doesn't exist, proceed with no assumptions about code style.

## Mode Detection

This skill has three modes. The mode is chosen by the user's opening message; no confirmation is asked.

| Mode | Trigger phrasing (examples, case-insensitive) | Flow file |
|---|---|---|
| **Epic** | `brainstorm an epic`, `this is an epic`, `EPIC:`, `epic brainstorm` | `skills/brainstorming/epic-flow.md` |
| **User Story** | `brainstorm a user story`, `this is a us`, `US:`, `user story brainstorm` | `skills/brainstorming/user-story-flow.md` |
| **Task** | *(default — anything else)* | continues in this SKILL.md |

### Detection rule

Scan the user's first message in the session for one of the Epic or User Story trigger phrasings above. Match case-insensitively against an explicit declaration — not a casual mention. If matched:

1. Announce the chosen mode to the user in one sentence: e.g., *"Running brainstorming in Epic mode."*
2. Load the corresponding flow file with the Read tool.
3. Follow that flow file as the authoritative checklist for the rest of the session. The `## Checklist` and `## Process Flow` sections below do NOT apply to Epic or User Story mode.

If neither Epic nor User Story triggers match, continue with the Task flow (the rest of this file). The user does not need to say "Task" explicitly — it is the default.

### Shared sections that still apply in all modes

- `## Prerequisite / Code Style Config` (above) — applies to all modes.
- `## Visual Companion` (below) — applies to all modes.
- `## When to Dispatch external-researcher` (below) — applies to all modes.

Everything else in this file below describes the Task flow only.

---

## Checklist
````

(The trailing `---` divider makes the boundary visible when reading SKILL.md top-to-bottom. The `old_string` above keeps the surrounding context so the Edit tool pins the insertion unambiguously.)

- [ ] **Step 4: Update the "After the Design" section's closing sentence**

In `skills/brainstorming/SKILL.md`, find the line that currently reads:

```
**The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is writing-plans.
```

Replace it with:

```
**For Task mode, the terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after a Task brainstorm is writing-plans. (Epic and User Story modes terminate in their own flow files and do NOT invoke writing-plans.)
```

- [ ] **Step 5: Verify the new content is present**

Run:
```bash
grep -c "^## Mode Detection" skills/brainstorming/SKILL.md
grep -c "epic-flow.md" skills/brainstorming/SKILL.md
grep -c "user-story-flow.md" skills/brainstorming/SKILL.md
grep -c "For Task mode, the terminal state" skills/brainstorming/SKILL.md
grep -c "Supports three modes: Task" skills/brainstorming/SKILL.md
```
Expected: every line prints `1` or greater.

- [ ] **Step 6: Verify SKILL.md still parses as valid frontmatter + markdown**

Run:
```bash
head -5 skills/brainstorming/SKILL.md
```
Expected output (first three lines):
```
---
name: brainstorming
description: "You MUST use this before any creative work - ...
```
The `description` line should be a single line (no unescaped newlines).

- [ ] **Step 7: Commit**

```bash
git add skills/brainstorming/SKILL.md
git commit -m "feat(brainstorming): dispatch epic and user-story modes from SKILL.md" \
  -m "Adds a Mode Detection section above the Task checklist that routes explicit Epic and User Story declarations to epic-flow.md and user-story-flow.md respectively. Task mode (default) behavior is unchanged. Frontmatter description updated to surface the three modes in skill lists." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 5: End-to-end structural smoke check

**Files:**
- None modified. This task runs read-only checks to confirm the four tasks above wired up correctly.

- [ ] **Step 1: Run the cross-file structural check**

Run:
```bash
set -e

# Files exist
test -f skills/brainstorming/SKILL.md
test -f skills/brainstorming/epic-flow.md
test -f skills/brainstorming/user-story-flow.md
test -f .agents/config/branches.md

# SKILL.md dispatches to both flow files
grep -q "epic-flow.md" skills/brainstorming/SKILL.md
grep -q "user-story-flow.md" skills/brainstorming/SKILL.md
grep -q "^## Mode Detection" skills/brainstorming/SKILL.md

# Epic flow has its owned sections
grep -q "^## Checklist" skills/brainstorming/epic-flow.md
grep -q "^## Issue creation" skills/brainstorming/epic-flow.md
grep -q "^## Branch + commit + push" skills/brainstorming/epic-flow.md
grep -q "^## Decomposition offer" skills/brainstorming/epic-flow.md
grep -q "EPIC: <name>" skills/brainstorming/epic-flow.md
grep -q "epic/<N>-<slug>" skills/brainstorming/epic-flow.md
grep -q "Type:Epic" skills/brainstorming/epic-flow.md

# User Story flow has its owned sections
grep -q "^## Checklist" skills/brainstorming/user-story-flow.md
grep -q "^## Issue creation" skills/brainstorming/user-story-flow.md
grep -q "^## Branch + commit + push" skills/brainstorming/user-story-flow.md
grep -q "^## Decomposition offer" skills/brainstorming/user-story-flow.md
grep -q '\[US-<N>\]' skills/brainstorming/user-story-flow.md
grep -q "us/<N>-<slug>" skills/brainstorming/user-story-flow.md
grep -q "Type:UserStory" skills/brainstorming/user-story-flow.md
grep -q "parent=epic/<N>" skills/brainstorming/user-story-flow.md

# Branches config lists both new prefixes
grep -q "Planning-level types" .agents/config/branches.md
grep -q "epic/501-billing-rewrite" .agents/config/branches.md
grep -q "us/512-invoice-export" .agents/config/branches.md

echo "ALL CHECKS PASSED"
```
Expected: final line is `ALL CHECKS PASSED`. If any `grep -q` fails, the script exits with non-zero and the failing check is the next task to fix.

- [ ] **Step 2: No commit**

This task is read-only. If everything passes, proceed to the execution handoff. If any check fails, the preceding task's implementation has a gap — fix it there, re-run this check, then proceed.

---

## Done criteria

- All four commits land on the feature branch.
- The Task-5 structural check prints `ALL CHECKS PASSED`.
- A dry-read of `skills/brainstorming/SKILL.md` top-to-bottom shows: frontmatter → intro → `<HARD-GATE>` → Anti-Pattern → Prerequisite → **Mode Detection (new)** → Checklist → Process Flow → rest of Task flow → Visual Companion. No content above Checklist was removed; only inserted.
