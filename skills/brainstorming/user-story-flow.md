# Brainstorming: User Story Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares a User Story brainstorm (e.g., "brainstorm a user story…", "this is a US…", "US:…"), OR when loaded from `epic-flow.md`'s decomposition offer with a `parent=epic/<N>` context.
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## Terminal state

This flow terminates at step 10 (the decomposition offer in `skills/brainstorming/decomposition-offer.md`). It does NOT invoke `writing-plans` directly. `writing-plans` is invoked only from inside a nested Task brainstorm — after the user picks a Candidate Task at the offer. On `stop`, this flow exits cleanly without chaining into any implementation skill (no `writing-plans`, no `using-git-worktrees`, no `executing-plans`).

## Parent context

If invoked with `parent=epic/<N>` and `parent_issue=<N>`, record those values; they drive:

- The spec's `Reference` section, which begins with `Part of #<N>`.
- The issue body, which begins with `Part of #<N>`.
- The branch base: `us/<M>-<slug>` branches from `epic/<N>-<epic-slug>` instead of `main`.

If invoked standalone (no parent), base = `main`.

## Shared prerequisites

Run these before starting the US-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present, following the same rule described in SKILL.md.
2. **Commit Config** — read `.agents/config/commit.md` if present, following the same rule described in SKILL.md. Spec commit uses `docs(brainstorming): add user story spec for <name>` by default.
3. **Branches Config** — read `.agents/config/branches.md` if present, following the same rule described in SKILL.md. US branch uses the `us/<N>-<keyword>` prefix defined there.
4. **Visual Companion** — if upcoming questions involve visual content, offer the companion per the rule in SKILL.md.

## Checklist

Create a TodoWrite task for each item:

1. Explore project context
2. Ask clarifying questions one at a time (actor, goal, benefit, scenario, DoD)
3. Propose 2–3 approaches with trade-offs and a recommendation
4. Present the spec sections below one at a time with approval gates
5. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-story.md`
6. Spec self-review — fix inline
7. User reviews the spec file; wait for approval
8. Confirm and create the GitHub User Story issue (two steps: create, then `gh issue edit` to insert the issue number into the title)
9. Create the `us/<N>-<slug>` branch (base = parent Epic branch or `main`), commit the spec, push
10. Decomposition offer (terminal) — present Candidate Tasks via the shared `skills/brainstorming/decomposition-offer.md` partial; on `stop`, exit without invoking any other skill

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

After push succeeds, run the shared `skills/brainstorming/decomposition-offer.md` partial with these inputs:

- `<parent-noun>` = `User Story`
- `<child-noun-plural>` = `Tasks`
- `<candidate-list>` = the Candidate Tasks bullet list from the spec
- `<chain-target>` = continue into the **default Task flow in `SKILL.md`** with the picked candidate as the seed request. Pre-seed the Task spec's Reference section with `Part of #<story_issue>` (and `Part of #<epic_issue>` if applicable). No issue or branch is created at the Task level — `hey-d:using-git-worktrees` and `hey-d:writing-plans` own that downstream.

The partial defines the offer text, response handling (`number` / `stop` / clarification), and the hard terminal guard. This flow's responsibility ends when the offer completes.

## Edge cases

- **Parent Epic branch was force-deleted everywhere.** Fall back to `main`; warn in the preview and include a note in the Reference section explaining the fallback.
- **`gh` not authenticated.** Surface the error; spec remains on disk.
- **Dirty working tree.** Refuse `git checkout -b`; ask the user to commit or stash first.
- **`gh issue edit` fails after the issue was created.** The issue exists with placeholder title. Retry `gh issue edit` or instruct the user to rename manually.
