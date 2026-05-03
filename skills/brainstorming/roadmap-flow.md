# Brainstorming: Roadmap Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares a Roadmap brainstorm (e.g., `ROADMAP: #117, #120-125`).
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## What Roadmap mode is (and isn't)

Roadmap mode turns a list of **existing GitHub issues** into a `roadmap.md` + `roadmap-meta.md` pair under `docs/roadmaps/<roadmap-id>/`, ready for the conductor skill to pick up. It does NOT:

- Create new GitHub issues — the user creates issues separately, this flow only consumes them.
- Commit the produced files — the contract is that conductor's session-start auto-commits them. This flow leaves the files uncommitted in the working tree.
- Run conductor — the user invokes `conductor <roadmap-id>` separately.

The flow's value-add over a hand-written roadmap is the **feasibility evaluator** subagent, which reads every issue body, scans the codebase for prerequisites, and surfaces gaps that a hand-author would miss.

## Shared prerequisites

Run these before starting the Roadmap-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present.
2. **Commit Config** — read `.agents/config/commit.md` if present (this flow does NOT commit, but the surrounding session may).
3. **Visual Companion** — skip. Roadmap mode produces text artifacts; no visual content is involved.
4. **`gh` authentication** — run `gh auth status` and `gh repo view --json name,owner`. Both must succeed. Halt with a clear error if not — the flow cannot fetch issues without `gh`.

## Checklist

Create a TodoWrite task for each item and complete them in order:

1. Parse the issue-spec
2. Fetch each issue
3. Blind-spot detection
4. Surface gaps to the user
5. Feasibility evaluator (blocking)
6. User decision on the report
7. Propose dependency order
8. Roadmap-id derivation
9. Write roadmap files (NO commit)
10. Hand-off announcement
11. Exit

## Step details

### 1. Parse the issue-spec

The trigger is `ROADMAP: <issue-spec> [optional one-liner]`. Extract the issue-spec (everything between `ROADMAP:` and the optional one-liner, comma-separated).

**Syntax:**
- `#117` → `[117]`
- `#120-125` → `[120, 121, 122, 123, 124, 125]` (range, inclusive)
- `#117, #120-125, #133` → `[117, 120, 121, 122, 123, 124, 125, 133]`
- Whitespace tolerant.

**Parser rules:**
- Strip `#` prefixes.
- Expand ranges (`A-B` where `B > A`).
- Dedupe (drop duplicates silently).
- Sort ascending.

**Halt conditions:**
- Trailing comma with nothing after → halt: "Trailing comma in issue-spec; please fix and retry."
- Range with `B <= A` (e.g., `#125-120`) → halt: "Invalid range '<spec>': end must be > start."
- Negative numbers, non-integers → halt with the offending token.

If the user did not supply an optional one-liner, capture an empty string for now (it'll be used in Step 8).

### 2. Fetch each issue

For each parsed issue number, run:

```bash
gh issue view <N> --json number,title,body,state,labels,comments
```

**Per-issue handling:**
- If the call fails with 404 → halt: "Issue #<N> not found in this repo. Please verify the issue exists and you have access."
- If the call fails with auth/perms → halt: "Cannot read issue #<N> (auth/permissions). Run `gh auth status` and retry."
- If the issue's `state == "closed"` → emit a warning: "Issue #<N> is closed; including in roadmap (skip = re-state spec without it)." Continue inclusion by default — the user may have closed an issue prematurely.
- If `labels` includes `wontfix` or `duplicate` → emit a warning, ask user inline: "Issue #<N> has label '<wontfix|duplicate>'. Include anyway? (yes/no)" Halt-back to Step 1 if they re-state.

Cache the fetched data — the feasibility evaluator (Step 5) needs it.

### 3. Blind-spot detection

For each fetched issue, scan title, body, and comments for these patterns:

- `#NNN` references (regex: `#\d+\b`).
- Checkbox sub-items (regex: `^\s*[-*]\s+\[\s*[xX ]?\s*\]\s+`).

Build a "candidate gaps" list:

- For each `#NNN` reference NOT in the user's spec → record `{number: <N>, source_issue: <issue>, source_kind: "body" | "title" | "comment", context: "<excerpt>"}`. The context excerpt is the surrounding sentence (max 120 chars), which often reveals the relationship ("depends on", "blocks", "see also").
- For each checkbox sub-item → record `{label: "<text>", source_issue: <issue>, completed: <bool from [x]>}`.

Filter checkbox items: ignore those marked completed (`[x]`); they're already done.

If both lists are empty → no gaps; skip Step 4 and proceed to Step 5.

### 4. Surface gaps to the user

Present the candidate gaps as a single message:

> **Blind-spot scan: items referenced by your roadmap but not included.**
>
> **Cross-issue references:**
> - `#119` — referenced by `#120` in body: "depends on #119 to be merged first"
> - `#133` — referenced by `#117` in comment thread: "see also #133 for context"
>
> **Subtask checkboxes from issue bodies:**
> - "Wire telemetry" — checkbox in `#122` (unchecked)
> - "Add migration rollback" — checkbox in `#125` (unchecked)
>
> Choose: `add <list of issue refs or subtask labels>` (include in roadmap), `ignore` (proceed without — checkbox subtasks become invisible), `redefine` (re-state the issue spec from scratch — restarts at Step 1).

Wait for user response. Parse:
- `add #119, "Wire telemetry"` → for each issue ref, fetch it via `gh issue view` (Step 2 logic) and append to the working set; for each subtask label, store as a synthetic "task" with no issue number (will get a synthetic `id` in the roadmap).
- `ignore` → proceed.
- `redefine` → restart at Step 1 with the new user-provided spec.

### 5. Feasibility evaluator (blocking)

Dispatch a subagent (model: `sonnet`) with these inputs:

- The full body and comments of every issue in the working set (after Step 4 additions).
- The cross-reference / blind-spot output from Step 3.
- A pointer to the local repo: "You may use `Grep`, `Glob`, and `Read` against the repository at the working directory to verify codebase prerequisites."

Use this prompt template:

```
You are a feasibility evaluator for a roadmap of GitHub issues. Conductor will dispatch AUTO-mode brainstorming agents against each task; your job is to flag anything that would block or mislead AUTO before the roadmap is locked.

**Issues in the roadmap (working set):**
[paste each issue's number, title, full body, and key comments here]

**Cross-references not in the roadmap (blind-spot scan output):**
[paste the gap list from Step 3, even if the user added some — flag the residual]

**Your task:** read every issue body in full, optionally grep the codebase for files/symbols/concepts named in issues (budget: ~50 grep operations total), and produce a markdown report with these sections:

## Per-task feasibility

For each issue, write:

### #<id> — <title>
- Completeness: <are acceptance criteria concrete enough that AUTO can produce a spec from this issue alone? ✓ / ⚠ <why> / ✗ <why>>
- Codebase prerequisites: <did you find the named files/symbols? findings, with file paths>
- External deps: <libraries, infra (Redis, Postgres extension, queue), env vars likely required>
- Risk: <low / medium / high — one-sentence why>

## Roadmap-level

- Coherence: <do these tasks form a deliverable thing, or a grab-bag?>
- Scope: <appropriate / too small / too large — sweet spot is 3-10 tasks>
- Hidden deps: <issues referenced but not in spec — even after Step 4>
- Proposed task order: <topological sort respecting deps; show the order>

## Open questions for the user

- <enumerate questions whose answers materially affect the roadmap>

## Verdict

READY | READY-WITH-CLARIFICATIONS | NEEDS-RESCOPE
```

Capture the report. The verdict is **advisory** — the user makes the final call in Step 6. The report is **blocking** in the sense that the orchestrator does not proceed past Step 5 until the report is in hand.

### 6. User decision on the report

Surface the report verbatim to the user, then ask:

> Choose: `accept` (proceed to dependency proposal), `clarify <answers>` (answer the open questions inline; re-run the evaluator), `rescope <new spec>` (drop or add tasks, re-run from Step 1), or `cancel` (exit cleanly without writing files).

Wait for response. Parse and dispatch:
- `accept` → proceed to Step 7.
- `clarify ...` → append the user's answers to the working-set context, re-dispatch the evaluator (Step 5). After the second pass, re-surface the new report and re-ask. Hard cap: 3 evaluator dispatches per session; if not converged, escalate: "Three rounds of evaluation and the roadmap still has open questions; recommend running an Epic brainstorm to decompose this further."
- `rescope ...` → restart at Step 1 with the new user-provided spec.
- `cancel` → exit the skill cleanly with no files written.

### 7. Propose dependency order

Build a dep graph from the issue cross-references in bodies:
- For issue A whose body contains "depends on #B", "blocked by #B", "after #B" near a `#B` reference → propose `deps: [B]` for A's task.
- The evaluator's Roadmap-level "Proposed task order" output also informs this.

Present the proposed roadmap as an inline preview:

```yaml
tasks:
  - id: 117
    title: "Add JWT verification middleware and types"
    deps: []
  - id: 120
    title: "Migrate session store to Redis"
    deps: [117]
  - id: 122
    title: "Wire feature flag for staged rollout to 10% traffic"
    deps: [117, 120]
```

Ask: "Confirm dependency order? (`yes`, `edit <change>` to modify, `cancel` to abort)"

On `edit`, take the change and re-show. On `cancel`, exit. On `yes`, proceed.

### 8. Roadmap-id derivation

If the user supplied an optional one-liner in the trigger (Step 1), derive the roadmap-id from it: lowercase, replace whitespace with `-`, strip non-alphanumeric except `-`. E.g., "auth rewrite" → `auth-rewrite`.

If no one-liner was supplied, ask: "Provide a short slug for this roadmap (e.g., `auth-rewrite`). It becomes `docs/roadmaps/<slug>/`."

**Collision check:** if `docs/roadmaps/<slug>/` already exists, halt: "Roadmap slug '<slug>' already exists at `docs/roadmaps/<slug>/`. Choose a different slug." Don't auto-suffix — the user should pick deliberately.

### 9. Write roadmap files (NO commit)

Create `docs/roadmaps/<slug>/`:

```bash
mkdir -p docs/roadmaps/<slug>
```

Write `docs/roadmaps/<slug>/roadmap.md`:

````markdown
# Roadmap: <one-liner if given, else slug>

<one-paragraph description; if no one-liner given, generate a short summary from issue titles>

## Tasks

```yaml
tasks:
  - id: <issue-number-or-synthetic-id>
    title: "<issue title>"
    deps: <list from Step 7>
    status: pending
  ... (repeat for each task in the working set, in the proposed order)
```
````

For "subtask" entries added in Step 4 that have no GitHub issue, use synthetic ids starting from a number above the highest GitHub issue id (e.g., if real issues are 117, 120-125, synthetic ids start at 1000). Document this in the body: "Synthetic ids 1000+ correspond to subtasks not tracked as GitHub issues."

Write `docs/roadmaps/<slug>/roadmap-meta.md`:

```markdown
---
roadmapId: <slug>
baseBranch: main
createdAt: <current ISO-8601>
owner: <user's git config user.email>
integrationBranch: conductor/<slug>
idsAreIssueNumbers: <true if all task ids are real issue numbers from this flow's fetches; false if any synthetic ids were used>
---
```

**Do NOT** stage or commit. Leave both files uncommitted in the working tree.

### 10. Hand-off announcement

Surface to the user (single message):

> Roadmap written to `docs/roadmaps/<slug>/`:
> - `roadmap.md` — <count> tasks, <count of external issues> from GitHub issues, <count of synthetic> synthetic
> - `roadmap-meta.md` — `idsAreIssueNumbers: <true|false>`, `baseBranch: main`, `integrationBranch: conductor/<slug>`
>
> Files are **uncommitted** in your working tree. Conductor will commit them onto the integration branch as its first action when you invoke:
>
> ```bash
> conductor <slug>
> ```
>
> If you want to revise before invoking, edit the files in place — conductor will pick up whatever's there at session start.

### 11. Exit

Exit the skill cleanly. Do NOT invoke `writing-plans`, `executing-plans`, or any conductor functionality. The user runs conductor separately.

## Edge cases

- **`gh` returns rate-limit errors during Step 2.** Halt with the rate-limit reset time surfaced from the error; user retries later.
- **Issue body is enormous (>100KB).** The evaluator's Sonnet dispatch could exceed token limits with 10+ huge issues. Mitigation: truncate per-issue to 5000 chars in the evaluator prompt, with a `[TRUNCATED — see issue #<N> on GitHub]` suffix.
- **All blind-spot references are already in the user's spec.** Step 3 yields an empty list; Step 4 is skipped.
- **Feasibility evaluator returns malformed report (missing "Verdict" section).** Re-dispatch once with a corrective preamble: "Your previous response was missing the required `## Verdict` section. Please re-emit the full report with all sections." If still malformed, halt and surface the raw report to the user.
- **User provides `redefine` at Step 4 with no spec.** Treat as `cancel`.
- **User provides `clarify` at Step 6 with empty answer.** Treat as `accept`.
- **`docs/roadmaps/<slug>/` exists but is empty.** Treat as a collision (Step 8 halt). Empty directories shouldn't normally exist; safer to refuse.
- **A subtask added in Step 4 has the same label as another roadmap's task (across different roadmaps).** Not a collision — different roadmap-ids isolate them.

## Hard-gate adaptation

The `<HARD-GATE>` block from SKILL.md still applies. The "design" presented to the user is the proposed roadmap (Step 7) plus the feasibility report (Step 5), and the user's `accept` at Step 6 + `yes` at Step 7 are the approval gates. Files are not written until those approvals pass.
