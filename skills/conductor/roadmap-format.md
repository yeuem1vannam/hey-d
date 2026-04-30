# Roadmap & Task Artifact Formats

This file is the source of truth for the durable-state files committed to `conductor/<roadmap-id>`. Conductor parses these files at runtime and writes them at task boundaries.

## `roadmap.md`

Plain markdown with a fenced YAML block listing tasks. The YAML is parsed by the orchestrator; the surrounding markdown is for the human reader.

### Required structure

````markdown
# Roadmap: <human-readable name>

<one-paragraph description of the roadmap's overall goal>

## Tasks

```yaml
tasks:
  - id: 1
    title: "Add JWT verification middleware"
    deps: []
    status: pending     # pending | in-progress | done | halted | failed
  - id: 2
    title: "Migrate session store to Redis"
    deps: [1]
    status: pending
  - id: 3
    title: "Wire feature flag for staged rollout"
    deps: [1, 2]
    status: pending
```
````

### Field rules

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | number | yes | Strictly increasing from 1. No gaps. |
| `title` | string | yes | One-line description used as the dispatch prompt's task description. |
| `deps` | number[] | yes | List of `id`s that must be `done` before this task is eligible. May be empty. |
| `status` | enum | yes | `pending` initially, transitions per phase machine in `state-schema.md`. |

### Status transitions

`pending` → `in-progress` (conductor commits this when starting the task)
`in-progress` → `done` (conductor commits when summary is written)
`in-progress` → `halted` (conductor commits on un-recoverable halt)
`halted` → `in-progress` (on resume + retry)
`pending` → `failed` (only via explicit user action; conductor never sets this directly)

**Anti-pattern:** never write a status the orchestrator does not recognise. `done!` ≠ `done`.

## `roadmap-meta.md`

Markdown file with a single YAML frontmatter block. No body content required (a one-line description above the frontmatter is allowed).

### Required structure

```markdown
---
roadmapId: auth-rewrite
baseBranch: main
createdAt: 2026-04-30T10:00:00Z
owner: dev@zapass.co
integrationBranch: conductor/auth-rewrite
---
```

### Field rules

| Field | Type | Required | Notes |
|---|---|---|---|
| `roadmapId` | string | yes | Must match the directory name `docs/roadmaps/<roadmapId>/`. Sanity-checked on init. |
| `baseBranch` | string | yes | Branch to fork the integration branch from. Defaults to `main` if absent, but should be set explicitly. |
| `createdAt` | ISO-8601 string | yes | Timestamp of init. Set once; never updated. |
| `owner` | string | no | Email or username for human-facing reporting. |
| `integrationBranch` | string | yes | The branch name conductor creates. Convention: `conductor/<roadmapId>`. |

`roadmap-meta.md` is written ONCE at init and amended only on explicit user action.

## `task-<N>/summary.md`

Written ONCE per task by conductor when AUTO returns success and the per-task PR has been merged into the integration branch. The strict shape ensures future tasks reading prior summaries find the same categories every time.

### Required structure

````markdown
# Task <N>: <title from roadmap.md>

**Branch:** `feat/<N>-<keys>`
**PR:** #<prNumber> (merged at <ISO-8601>)
**AUTO spec:** `docs/specs/<spec-filename>.md`
**AUTO plan:** `docs/plans/<plan-filename>.md`

## Built

<bullet list — each bullet names a concrete artefact: a function, a file, an endpoint, a config change. Past-tense.>

- Added `verifyJwt` middleware in `src/auth/middleware.ts`
- Wired middleware into the request pipeline in `src/server.ts:42`
- Defined `JwtPayload` type in `src/auth/types.ts`

## Decided

<bullet list — design or product decisions made during the task. Each line: **what** and **why** in one sentence.>

- Used HS256 instead of RS256 because we don't yet have a key-rotation pipeline.
- Token TTL set to 15min; refresh-token flow deferred to task 3.

## Touched

<file list — every path AUTO committed. Read from `git diff --name-only`.>

- `src/auth/middleware.ts` (new)
- `src/auth/types.ts` (new)
- `src/server.ts` (modified)
- `tests/auth/middleware.test.ts` (new)

## Gotchas

<bullet list — anything a future task reader needs to know to avoid breaking this task's work. Empty section is allowed if there really are none — write "None.">

- The middleware mutates `req.user`; downstream handlers MUST treat it as set.
- HS256 secret is read from `process.env.JWT_SECRET`; tests need that env var.
````

### Field rules

- The four section headings (`## Built`, `## Decided`, `## Touched`, `## Gotchas`) are MANDATORY and case-sensitive. Conductor reads them by exact match when assembling context for downstream tasks.
- Each section may be empty (write `None.`) but the heading must still be present.
- The leading metadata block (Branch / PR / AUTO spec / AUTO plan) is mandatory; without it conductor can't reconstruct the task's git context on a future read.

## How conductor reads these files

- `roadmap.md` — parsed at task selection (find next `pending` task with all `deps` `done`).
- `roadmap-meta.md` — parsed once at session start; cached.
- `task-<N>/summary.md` — parsed when assembling the dispatch prompt for a task whose `deps` include `N`. Conductor passes the relevant summaries to AUTO so it has prior-task context.

## Examples

See `examples/roadmap.md`, `examples/roadmap-meta.md`, `examples/task-summary.md` for copy-paste templates.
