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
| `id` | number | yes | When the roadmap was produced by the `ROADMAP:` brainstorm flow, this is the GitHub issue number (e.g., `117`). When the roadmap is hand-written, this is a synthetic 1..N index, strictly increasing from 1, no gaps. Conductor doesn't differentiate — it uses `id` literally for branch naming, summary directory naming, and event-log keys. The `idsAreIssueNumbers` field in `roadmap-meta.md` declares which world this roadmap is in. |
| `title` | string | yes | One-line description used as the dispatch prompt's task description. **When `idsAreIssueNumbers: true`, treat this as a stale label only** — the GitHub issue body (re-fetched at dispatch time per `conducting-flow.md` § Step 4 Section 2) is the authoritative source. |
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
idsAreIssueNumbers: false
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
| `idsAreIssueNumbers` | bool | no | Default `false`. When `true`, conductor treats `roadmap.md`'s `id` values as GitHub issue numbers (used in PR bodies for "Closes #<id>" auto-close phrasing and final-PR title formatting). The `ROADMAP:` flow always sets this to `true`. Hand-written roadmaps default to `false`. |

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

## `conductor.log.jsonl`

A per-roadmap append-only event log. Lives at `docs/roadmaps/<roadmap-id>/conductor.log.jsonl`. Committed to the integration branch at task boundaries (one flush per task-done commit). The file is durable project history — every gate decision, every dispatch, every halt is recorded.

### Event shape

Every event is a single line of valid JSON. All events share these top-level fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `ts` | ISO-8601 string | yes | When the event occurred. |
| `phase` | string | yes | The conductor phase at emission time (matches `state-schema.md` enum). |
| `taskId` | number \| null | yes | The `id` from `roadmap.md` for the current task; null only for roadmap-level events. |
| `eventType` | string | yes | Discriminator — one of the values below. |

### Event types

| `eventType` | Additional fields |
|---|---|
| `session-start` | `roadmapId`, `baseBranch`, `integrationBranch` |
| `task-start` | `branchKey`, `dependencies` (array of ids) |
| `auto-dispatched` | `subAgentId`, `dispatchPromptHash` (sha256 hex of full prompt), `branchContract` (verbatim) |
| `auto-returned` | `subAgentId`, `returnType` (`success` / `gate` / `failure`), `returnMessageExcerpt` (first 500 chars) |
| `gate-decision` | `subAgentId`, `gateQuestion` (verbatim), `decision` (`answer` / `halt`), `groundingSource` (when `decision == answer`), `category` (`A` / `B` / `C` per `answer-authority.md`) |
| `review-dispatched` | `currentReviewId`, `prNumber` |
| `review-verdict` | `currentReviewId`, `mustFixesCount`, `nitsCount`, `ciStatus` (`green` / `red`), `verbatimMustFixes` (array of strings) |
| `feedback-sent` | `subAgentId`, `feedbackBody`, `feedbackKind` (`must-fix-bundled` / `ci-flake` / `nit-only`), `fixLoopRound`, `nitFixAttempts` |
| `merge-decision` | `prNumber`, `result` (`merged` / `failed`), `mergeSha` |
| `task-halted` | `lastHaltQuestion`, `cause` (`gate` / `failure` / `fix-loop-exhausted` / `merge-failed` / `contract-violation`) |
| `task-resumed` | `resumeAction` (`resume` / `restart` / `abort`), `userMessage` (verbatim, only when `resumeAction == resume`) |
| `task-done` | `prNumber`, `summaryPath`, `journalPath`, `mergeSha` |
| `roadmap-end` | `finalPrUrl`, `tasksCompleted`, `tasksHalted`, `totalDuration` (ISO 8601 duration) |
| `agent-message` | `sender` (`conductor`/`auto`/`review`), `recipient` (same enum), `subAgentId` (string \| null), `messageKind` (see § `messageKind` enum below), `body` (verbatim message text) |

### `messageKind` enum (for `agent-message` events)

`agent-message` events are co-emitted alongside structural events at every Conductor↔AUTO or Conductor↔Review exchange. The structural event keeps its existing typed metadata (counts, IDs, decisions); the agent-message carries the verbatim message body. **The agent-message body is the canonical location for the journal**; the structural-event verbatim fields (`branchContract`, `feedbackBody`, `verbatimMustFixes`) stay for backward compat and direct-query convenience.

| `messageKind` | Sender → Recipient | Co-emitted with |
|---|---|---|
| `dispatch-prompt` | conductor → auto | `auto-dispatched` |
| `gate-question` | auto → conductor | `auto-returned` (returnType=gate) |
| `gate-answer` | conductor → auto | `gate-decision` (decision=answer) |
| `success-return` | auto → conductor | `auto-returned` (returnType=success) |
| `failure-return` | auto → conductor | `auto-returned` (returnType=failure) |
| `review-prompt` | conductor → review | `review-dispatched` |
| `review-return` | review → conductor | `review-verdict` |
| `feedback` | conductor → auto | `feedback-sent` |
| `fixes-pushed-return` | auto → conductor | `auto-returned` (after feedback push, returnType=success) |

**Halt path:** a `gate-decision` with `decision: "halt"` does NOT co-emit a `gate-answer` agent-message — there is no answer when conductor halts to human.

**Two-write atomicity:** the structural event and its sibling agent-message are two separate `echo … >>` appends. POSIX guarantees each single-line append is atomic, but a crash between the two writes leaves an orphaned structural event with no message body. The journal generator handles this with a `[message body unavailable]` placeholder block.

**Verbatim-body contract (applies to ALL `agent-message` events).** The `body` field MUST equal the exact string transmitted to or received from the agent — byte-for-byte. Specifically:

- For conductor-sourced kinds (`dispatch-prompt`, `gate-answer`, `review-prompt`, `feedback`): `body` is the literal string passed as the `prompt` parameter to the `Agent`/`SendMessage` tool, NOT a description of what conductor intends to communicate.
- For agent-sourced kinds (`gate-question`, `success-return`, `failure-return`, `fixes-pushed-return`, `review-return`): `body` is the agent's full final message verbatim, NOT a one-line summary or extracted excerpt. (The structural event's `returnMessageExcerpt` field is where you put the truncated form; the agent-message `body` stays full.)

**Anti-pattern:** writing `body: "Conductor dispatched AUTO with explicit instructions to do X, Y, Z"` when the actual prompt was a 2000-character structured document with sections. That kind of paraphrase makes the journal lie about what was sent and breaks reproducibility (the `dispatchPromptHash` in the structural event won't match a sha256 of the body). If the body looks dramatically shorter than the actual message, the LLM constructing the JSON paraphrased — re-emit with the verbatim string.

**Hard machine check** for the `dispatch-prompt` kind specifically lives in `conducting-flow.md` § Step 4.5 (heredoc construction + pre-dispatch self-check + hash equality). The contract above is the schema-level statement of the same rule, applied to ALL agent-message kinds; the conducting-flow version is the load-bearing enforcement at write time.

### Write mechanics (conductor side)

- During a task, conductor appends each event to a buffer at `docs/roadmaps/<roadmap-id>/state/events.buffer.jsonl` (gitignored, in the conductor worktree). Atomic shell append:
  ```bash
  echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
  ```
- POSIX guarantees a single-line append is atomic — no temp-file dance needed.
- At task-done, the buffer is concatenated onto the durable `conductor.log.jsonl` and the buffer is truncated. See `conducting-flow.md` Step 12.

### Crash recovery

- Buffer survives across crashes (real file in worktree). On resume, if the buffer is non-empty for a task that's not yet `done`, those events represent un-flushed work for the still-in-progress task — preserve.
- If the buffer is non-empty and the task IS marked `done` in `roadmap.md`, the flush was interrupted — re-run the flush (concat + truncate) idempotently.

## `task-<N>/journal.md`

A human-readable narrative derived from the event log at task-done. Co-located with `summary.md` under `docs/roadmaps/<roadmap-id>/task-<id>/`. Generated once per task, NOT updated on resume.

### Shape

```markdown
# Task <id> — <title>

**Branch:** `feat/<id>-<keys>`   |   **PR:** [#<prNumber>](<prUrl>) (merged at <mergeSha>)
**Started:** <ISO-8601 ts of session-start or task-resume>   |   **Done:** <ISO-8601 ts of task-done>   |   **Duration:** <hours:minutes>

## Timeline

<HH:MM:SS>  Dispatched AUTO with branch contract for <branchKey> (sub-agent <subAgentId>)
<HH:MM:SS>  AUTO returned at Gate <A|B>: "<gateQuestion>"
<HH:MM:SS>  Conductor answered "<answer>" — grounded in <groundingSource>; Category <A|B|C>
<HH:MM:SS>  AUTO returned success — PR #<prNumber> opened
<HH:MM:SS>  Dispatched review agent against PR #<prNumber> (sub-agent <currentReviewId>)
<HH:MM:SS>  Review verdict: <mustFixesCount> must-fixes, <nitsCount> nits; CI <green|red>
<HH:MM:SS>  Conductor merged PR #<prNumber> (commit <mergeSha>)
<HH:MM:SS>  Wrote task-<id>/summary.md, marked roadmap.md task done

## Gate decisions

- **Q:** <gateQuestion>
- **A:** <answer text or "[halted to human]">
- **Source:** <groundingSource> (Category <A|B|C>)

## Review rounds

- Round <fixLoopRound>: <mustFixesCount> must-fixes, <nitsCount> nits, CI <green|red>
  <if must-fixes:>  Sent must-fix feedback (nits bundled); AUTO pushed fixes
- <if nit-only round ran:>  Best-effort nit round (`nitFixAttempts=1`): <nitsCount> nits; AUTO <pushed fixes | skipped>
- <if cap reached with nits remaining:>  Cap reached; remaining nits posted as PR comment; merged as-is

## Conversation transcript

### [<HH:MM:SS>] <sender> → <recipient> (<subAgentId>) — <messageKind>
> <body, blockquoted line by line>

### [<HH:MM:SS>] <sender> → <recipient> (<subAgentId>) — <messageKind>
> <body, blockquoted line by line>
```

### Generation rules

- Read the slice of `conductor.log.jsonl` corresponding to this task (from `task-start` to `task-done`).
- For each event, emit one timeline line per the templates above.
- Group `gate-decision` events under "Gate decisions" with the verbatim Q/A.
- Group `review-verdict` events under "Review rounds".
- Render `agent-message` events under "Conversation transcript" — one block per event, in chronological order. Block header: `### [HH:MM:SS] <sender> → <recipient> (<subAgentId>) — <messageKind>`. Body is blockquoted by prepending `> ` to each line; empty lines in the body become `>`.
- If a structural event has no sibling agent-message (crash between the two writes, or a v2.5 log read by a v2.6 generator), insert a placeholder block: `### [HH:MM:SS] <sender> → <recipient> — <inferred kind from structural event> [message body unavailable]`.
- If a section has zero events (e.g., no gate decisions, or no agent-messages because the log predates v2.6), omit the heading.
- Generation is deterministic — two runs over the same log slice produce identical journals.

## How conductor reads these files

- `roadmap.md` — parsed at task selection (find next `pending` task with all `deps` `done`).
- `roadmap-meta.md` — parsed once at session start; cached.
- `task-<N>/summary.md` — parsed when assembling the dispatch prompt for a task whose `deps` include `N`. Conductor passes the relevant summaries to AUTO so it has prior-task context.

## Examples

See `examples/roadmap.md`, `examples/roadmap-meta.md`, `examples/task-summary.md` for copy-paste templates.
