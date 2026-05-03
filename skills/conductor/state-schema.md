# State Schema

The conductor's ephemeral runtime state lives in a single JSON file:

```
docs/roadmaps/<roadmap-id>/state/state.json
```

This directory is **gitignored** (see `.gitignore`'s `docs/roadmaps/*/state/` line) and lives only in the conductor's own worktree — never in the main working tree. Crash recovery reads this file on resume.

## Field reference

| Field | Type | Required | Purpose |
|---|---|---|---|
| `roadmapId` | string | yes | The roadmap-id this state belongs to. Sanity check on resume. |
| `currentTaskId` | number | yes | Which task in `roadmap.md` is active. The value is whatever `roadmap.md`'s `id` field holds — a GitHub issue number when `roadmap-meta.md` has `idsAreIssueNumbers: true`, a synthetic 1..N index otherwise. Conductor reads it literally. `0` is a sentinel meaning "no task picked yet" used only at fresh-state initialization. |
| `currentBranch` | string \| null | yes | Per-task feat branch checked out on the main tree (e.g., `feat/2-token-storage`). Null only between tasks. |
| `subAgentId` | string \| null | yes | The dispatched AUTO agent's ID, used for SendMessage continuation. Null when no AUTO is running. |
| `dispatchedAt` | ISO-8601 string \| null | yes | When the current AUTO dispatch went out. Used to detect stuck agents. |
| `autoReturnedAt` | ISO-8601 string \| null | yes | When AUTO last returned (success or gate question). Null while AUTO is running. |
| `phase` | enum (see below) | yes | The state machine's current position. **Resume's first action is `switch (phase)`.** |
| `lastHaltAt` | ISO-8601 string \| null | yes | When conductor last halted to a human. Null in non-halted phases. |
| `lastHaltQuestion` | string \| null | yes | The question or failure text that triggered the halt. Surfaced verbatim on resume. |
| `fixLoopRound` | number | yes | Review-fix iteration count, 0 to 3. |
| `currentReviewId` | string \| null | yes | Dispatched review agent's ID. Used to know whether feedback for this round was already sent. |
| `prNumber` | number \| null | yes | The per-task PR number (from `gh pr create`). Null until AUTO opens the PR. |
| `prUrl` | string \| null | yes | Convenience for human-facing reporting. Mirrors `prNumber`. |
| `currentSpecPath` | string \| null | yes | Path to AUTO's spec for the current task (e.g., `docs/specs/2026-04-30-token-storage-design.md`). Captured when AUTO returns success; required by the review-dispatch prompt and must survive a resume from `awaiting-review`. |

All required fields MUST be present (with `null` where the value is not yet known). Missing keys = corrupted state, treat as needing human intervention.

### Fresh-state initialization

`examples/state.json` shows a mid-flight state (phase `awaiting-review`). When conductor initializes a fresh `state.json` at session start (per `conducting-flow.md` § Session start checklist Step 7), the values are:

```json
{
  "roadmapId": "<from roadmap-meta.md>",
  "currentTaskId": 0,
  "currentBranch": null,
  "subAgentId": null,
  "dispatchedAt": null,
  "autoReturnedAt": null,
  "phase": "dispatching",
  "lastHaltAt": null,
  "lastHaltQuestion": null,
  "fixLoopRound": 0,
  "currentReviewId": null,
  "prNumber": null,
  "prUrl": null,
  "currentSpecPath": null
}
```

`currentTaskId: 0` is a sentinel meaning "no task picked yet"; the per-task loop's Step 1 sets it to a real id.

## `phase` enum (exhaustive)

| Phase | Meaning | Resume action |
|---|---|---|
| `dispatching` | Conductor is mid-flight in branch-create + AUTO dispatch. Crash here means the feat branch may or may not exist. | Re-do branch setup if missing; re-dispatch AUTO. |
| `auto-running` | AUTO has been dispatched and has not yet returned. | Try `SendMessage subAgentId` with an empty nudge; if it fails, re-dispatch with continuation note (see `conducting-flow.md` § Re-dispatch). |
| `auto-blocked-on-gate` | AUTO returned with a gate question; conductor halted to human. | Wait for human answer; on resume, SendMessage the answer. If sub-agent dead, re-dispatch with continuation note that includes `lastHaltQuestion`. |
| `awaiting-review` | AUTO returned success and PR is open; review agent not yet dispatched. | Dispatch the review agent against `prNumber`. |
| `review-running` | Review agent has been dispatched. | Try `SendMessage currentReviewId`; if dead, re-dispatch review on the same PR. |
| `review-feedback-sent` | Review returned must-fixes; SendMessage'd to AUTO; awaiting AUTO's push. | Try `SendMessage subAgentId` to nudge; if dead, re-dispatch AUTO with feedback context. |
| `awaiting-merge` | Review clean + CI green; conductor about to call `gh pr merge`. | Verify PR still mergeable (`gh pr view --json mergeable,mergeStateStatus`), then merge. |
| `summary-writing` | Merged successfully; writing `task-N/summary.md` and updating `roadmap.md`. | Verify the summary file (idempotent); finish the commit + push if not done. |
| `task-halted` | Round counter exceeded, AUTO failed, or conductor couldn't answer a gate. | Surface `lastHaltAt` + `lastHaltQuestion` to human; await `resume` / `restart` / `abort`. |
| `done` | This task is complete; conductor about to move to next. | Pick next task with deps satisfied; reset state to `dispatching`. |

## Phase transitions

```
dispatching → auto-running
auto-running → auto-blocked-on-gate (AUTO returned a gate question)
auto-running → awaiting-review (AUTO returned success with PR open)
auto-running → task-halted (AUTO returned failure or contract violation)
auto-blocked-on-gate → auto-running (conductor SendMessages an answer)
auto-blocked-on-gate → task-halted (conductor cannot answer)
awaiting-review → review-running
review-running → review-feedback-sent (must-fixes returned)
review-running → awaiting-merge (clean review + green CI)
review-feedback-sent → review-running (AUTO pushed; loop back) — increments fixLoopRound
review-feedback-sent → task-halted (fixLoopRound > 3)
awaiting-merge → summary-writing
awaiting-merge → task-halted (gh pr merge failed)
summary-writing → done
done → dispatching (next task)
```

Any transition NOT in this list is a bug. The orchestrator MUST log the attempted transition and halt rather than executing it.

## Atomic write rule

`state.json` writes use the temp-file-and-rename pattern to survive a crash mid-write:

```bash
TMP=$(mktemp "$STATE_PATH.XXXXXX")
echo "$NEW_JSON" > "$TMP"
mv "$TMP" "$STATE_PATH"
```

Never write directly to `state.json`. A crash mid-`echo` would leave the file unparseable.

## Event log buffer

A second gitignored file lives next to `state.json`:

```
docs/roadmaps/<roadmap-id>/state/events.buffer.jsonl
```

Append-only, one JSON event per line. Used by conductor to accumulate events during a task before flushing them to the durable `conductor.log.jsonl` (committed at task-boundaries). Schema for the events themselves lives in `roadmap-format.md` § `conductor.log.jsonl`.

### Append rule

Single-line writes only. POSIX guarantees the line lands intact:

```bash
echo "$EVENT_JSON" >> "$STATE_DIR/events.buffer.jsonl"
```

Never use multi-line writes; an interrupted write would corrupt the JSONL and make resume impossible. If an event payload contains newlines, escape them in the JSON encoding (most JSON encoders do this by default).

### Flush rule

At task-done (per `conducting-flow.md` Step 12):

```bash
cat "$STATE_DIR/events.buffer.jsonl" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/conductor.log.jsonl"
: > "$STATE_DIR/events.buffer.jsonl"
```

Flush is idempotent — re-running it on a partially-flushed state appends the buffer's current contents (which is empty after a successful prior flush) and truncates again. Resume that detects an interrupted flush re-runs the same two commands.
