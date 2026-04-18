# `.agents/config/github.md` Guide

Place this file at `.agents/config/github.md` at your repository root (the directory `git rev-parse --show-toplevel` returns) to customize how agents create pull requests and address PR review comments.

In a monorepo, the file lives at the git repository root, not at the per-package workspace root. Agents read and write all `.agents/` paths (config and cache) relative to the repository root — this prevents a stray `.agents/` from being created inside a subpackage.

---

## Template

```markdown
# GitHub Config

## Org Repo

The org-level `.github` repository for shared PR templates:

`<org>/.github`

If a PR template is not found in the workspace `.github/pull_request_template.md`,
fetch it from this repo instead. Cache the result to `<repo-root>/.agents/cache/templates/`
(resolve `<repo-root>` via `git rev-parse --show-toplevel`) so subsequent PR
creations do not need to re-fetch.

## PR Title Format

Follow `<SCOPE>: <summary>` — where scope is UPPERCASE.

- Keep the title under 72 characters.
- `<scope>` matches the package or domain area changed (e.g. `web`, `api`, `db`).

## Base Branch

Determine the base branch from the git history — find the nearest ancestor branch, not a hardcoded default. For example, if the current branch was checked out from a feature branch, the PR should target that feature branch, not `main`.

To detect:
1. Compare merge-base distance from HEAD to all remote branches.
2. Pick the branch with the fewest commits ahead (closest ancestor).
3. Confirm the detected base branch with the user before creating the PR.

## PR Body

Use the template found via the resolution order above. Fill in:

- **Proposed Changes**: bullet list of what changed, based on commit log.
- **Issue reference**: link the related issue if known (ask the user if not obvious).
- **Test Plan**: verification steps the reviewer should follow.
- **Demo**: leave blank unless the user provides screenshots or recordings.

Always preview the full draft and get explicit approval before creating the PR.

## Addressing Review Comments

When fixing PR review feedback:

- Fetch all inline comments, review bodies, and general PR comments.
- Skip resolved threads, bot boilerplate, and pure praise with no action item.
- Present a numbered summary and ask which comments to address before touching code.
- Commit fixes using: `fix(<scope>): address PR #<N> review feedback`
- Ask the user if they want to reply to each addressed comment on the PR.
```

---

## Field Reference

| Field | What it controls |
|---|---|
| `Org Repo` | Fallback source for PR templates when `.github/pull_request_template.md` is absent in the workspace |
| `PR Title Format` | Convention for PR titles (defaults to commit convention if absent) |
| `Base Branch` | Default target branch when creating PRs |
| `PR Body` | Instructions for filling in the PR description |
| `Addressing Review Comments` | Workflow rules for fixing review feedback |

## Template Resolution Order

When creating a PR, agents look for a template in this order:

1. Workspace `.github/pull_request_template.md`
2. Org repo specified in `Org Repo` field (fetched via `gh`)
3. Cached copy at `<repo-root>/.agents/cache/templates/pull_request_template.md` (used if fetch fails or is unavailable)

Add `.agents/cache/` to the `.gitignore` at your repository root.

## Minimal Config

If you only need to set an org repo and nothing else:

```markdown
# GitHub Config

## Org Repo

`my-org/.github`
```

All other fields will fall back to defaults.
