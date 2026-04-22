# Brainstorming: Epic Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares an Epic brainstorm (e.g., "brainstorm an epic…", "this is an Epic…", "EPIC:…").
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## Shared prerequisites

Run these before starting the Epic-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present, following the same rule described in SKILL.md.
2. **Commit Config** — read `.agents/config/commit.md` if present, following the same rule described in SKILL.md. Spec commit uses `docs(brainstorming): add epic spec for <name>` by default.
3. **Branches Config** — read `.agents/config/branches.md` if present, following the same rule described in SKILL.md. Epic branch uses the `epic/<N>-<keyword>` prefix defined there.
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
issue_url=$(gh issue create \
  --title "EPIC: <name>" \
  --label "Type:Epic" \
  --body-file "$BODY_FILE")
issue_number="${issue_url##*/}"
# issue_number is used below as <N> in the branch name
```

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
