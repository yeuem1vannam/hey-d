# Conducting Flow

> Authoritative orchestration checklist for the conductor skill. SKILL.md sets the session up; this file owns every action thereafter.

This file references and depends on:
- `state-schema.md` — `state.json` shape and `phase` enum
- `roadmap-format.md` — `roadmap.md`, `roadmap-meta.md`, `summary.md` shapes
- `answer-authority.md` — the answer-vs-halt heuristic
- `resume-procedure.md` — for any resume scenario (see also: `SKILL.md` § Mode detection)

Read each one fully before starting.

## Session start checklist

Run these in order. Halt with a clear error on the first failure.

0. **Detect or reuse a stashed seed bundle.**

   State.json doesn't exist yet at this point (it's initialized in Step 7 inside the worktree). The recovery primitive for the seed-commit pipeline is therefore a **deterministic git stash message** — the stash itself records the pending hand-off across crashes.

   Stash message format: `conductor:<roadmap-id>:seed`

   a. Check for an existing stash entry with that exact message:
      ```bash
      git stash list | grep "conductor:<roadmap-id>:seed"
      ```

   b. **If an existing stash entry is found** (resume after a Step-0..Step-5a crash): do nothing here. Step 5a will pop it once the worktree is built. Skip to Step 1.

   c. **Otherwise**, scan the working tree:
      ```bash
      git status --porcelain -- "docs/roadmaps/<roadmap-id>/"
      ```

      - If output is empty → no-op (user pre-committed the seed files, the v1 path). Skip to Step 1.
      - If output is non-empty → stash the whitelisted files:
        ```bash
        git stash push --include-untracked \
          -m "conductor:<roadmap-id>:seed" \
          -- "docs/roadmaps/<roadmap-id>/"
        ```
        The deterministic message is the recovery contract.

1. **Verify prerequisites** (per `SKILL.md` § Prerequisites): roadmap file exists, meta file exists, `gh` authenticated, working tree clean.
2. **Load `roadmap-meta.md`.** Cache `baseBranch`, `integrationBranch`, `roadmapId`, `idsAreIssueNumbers` (default `false` if absent). The `idsAreIssueNumbers` flag is load-bearing for the dispatch prompt — see Step 4.
3. **Detect existing in-flight state.** If `docs/roadmaps/<roadmapId>/state/state.json` exists, follow `resume-procedure.md` instead of init. Otherwise proceed to init.
4. **Init the integration branch** (only on fresh roadmap, no existing state):
   ```bash
   git fetch origin "$BASE_BRANCH"
   git push origin "origin/$BASE_BRANCH:refs/heads/$INTEGRATION_BRANCH"
   ```
   This creates the integration branch on the remote without touching local working trees.
5. **Init the conductor worktree.** Use `hey-d:using-git-worktrees` to create a worktree at `<repo>/.worktrees/conductor-<roadmapId>/` checked out to `$INTEGRATION_BRANCH`. Confirm with `git worktree list`.

5a. **Check for the seed stash and pop it into the worktree if present.**

    ```bash
    STASH_REF=$(git stash list | grep "conductor:<roadmap-id>:seed" | head -1 | cut -d: -f1)
    ```

    - If `STASH_REF` is empty → no-op (user pre-committed; v1 path). Skip to Step 6.
    - If `STASH_REF` is set:
      ```bash
      git -C "$WORKTREE" stash pop "$STASH_REF"
      git -C "$WORKTREE" add "docs/roadmaps/<roadmap-id>/"
      git -C "$WORKTREE" commit -m "chore(conductor): seed roadmap <roadmap-id>"
      git -C "$WORKTREE" push
      ```

    The main tree is now clean. The seed files are committed durably on the integration branch and will reappear in the main tree's working area when conductor checks out the per-task feat branch (Step 3 of the per-task loop), since that branch is forked from the integration branch.

6. **Init the state directory.** Inside the worktree:
   ```bash
   mkdir -p "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state"
   ```
   This directory is gitignored — see `.gitignore`'s `docs/roadmaps/*/state/` line.
7. **Init `state.json`** with all required fields. Use the template at `examples/state.json` and set:
   - `roadmapId` = the loaded value
   - `phase = "dispatching"` (we're about to start task selection)
   - everything else `null` or `0`

   Write atomically (temp + rename, see `state-schema.md`).
8. **Announce session start to the user.**

   > Conductor session started for roadmap `<roadmapId>`.
   > - Integration branch: `<integrationBranch>` (forked from `<baseBranch>`).
   > - Worktree: `<worktreePath>`.
   > - Tasks: `<count>` total, `<count>` pending.
   >
   > Beginning task selection.

   **Emit `session-start`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "dispatching" \
     --arg roadmapId "$ROADMAP_ID" \
     --arg baseBranch "$BASE_BRANCH" \
     --arg integrationBranch "$INTEGRATION_BRANCH" \
     '{ts:$ts, phase:$phase, taskId:null, eventType:"session-start", roadmapId:$roadmapId, baseBranch:$baseBranch, integrationBranch:$integrationBranch}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

## Worktree discipline (load-bearing)

These five rules MUST be enforced for every operation in the per-task loop, the resume procedure, and end-of-roadmap cleanup. Violating any of them poisons subsequent dispatches or corrupts state.

1. **Conductor's CWD stays on the main tree.** Do NOT `cd` into the worktree — the working directory is inherited by Agent dispatches; if conductor's CWD becomes the worktree, AUTO would inherit it and commit to `conductor/<roadmapId>` directly. All conductor operations targeting the worktree use **absolute paths** or `git -C "$WORKTREE"` — never `cd` followed by a bare git command.
2. **AUTO inherits the main-tree CWD.** AUTO sees `feat/<N>-<keys>` checked out on the main tree and works there normally. No special instructions needed beyond the dispatch contract.
3. **Same branch never in two worktrees.** `conductor/<roadmapId>` is held by the conductor worktree, so the main tree never directly checks it out. The main tree only checks out per-task feat branches that were *branched off* `conductor/<roadmapId>`.
4. **After `gh pr merge`, refresh the worktree's ref before writing the summary.** The merge commit lands on the remote `conductor/<roadmapId>`; the worktree's local copy is stale until conductor runs `git -C "$WORKTREE" fetch && git -C "$WORKTREE" reset --hard origin/conductor/<roadmapId>` (or `pull --ff-only`). Skipping this means writing `summary.md` against a stale tip and rejecting on push.
5. **Clean up the worktree at end-of-roadmap.** Once the final PR is opened, conductor runs `git worktree remove "$WORKTREE"`. State directory (gitignored) goes with it. The integration branch survives on the remote until the human merges or deletes it.

### Event log emissions

Conductor emits structured events to `docs/roadmaps/<roadmap-id>/state/events.buffer.jsonl` (gitignored, in the conductor worktree) at the following points. The event taxonomy and shape live in `roadmap-format.md` § `conductor.log.jsonl`. Buffer flushes to the durable `conductor.log.jsonl` at task-done (Step 12).

The append idiom is always atomic single-line:

```bash
EVENT_JSON='{"ts":"<ISO-8601>","phase":"<phase>","taskId":<id>,"eventType":"<type>",...}'
echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
```

All timestamp values use the system clock at emission time. All `phase` values match `state-schema.md`'s enum. All optional event-type-specific fields are documented in `roadmap-format.md`.

**Emission points:**

| Step | eventType emitted |
|---|---|
| § Session start, Step 8 (announce) | `session-start` |
| § Per-task loop, Step 1 (pick task) | `task-start` |
| § Per-task loop, Step 5 (dispatch AUTO) | `auto-dispatched` |
| § Per-task loop, Step 6 (handle AUTO return) | `auto-returned`; if blocking gate, also `gate-decision` |
| § Per-task loop, Step 8 (dispatch review) | `review-dispatched` |
| § Per-task loop, Step 9 (process review return) | `review-verdict`; if loop-back, also `feedback-sent` |
| § Per-task loop, Step 10 (merge) | `merge-decision` |
| § Per-task loop, Step 12 (write summary, mark done) | `task-done` |
| § Halt-to-human (any halt path) | `task-halted` |
| `resume-procedure.md` Step 6 (resume choice) | `task-resumed` |
| § End of roadmap | `roadmap-end` |
| § Per-task loop, Step 5 (dispatch AUTO) | `agent-message` (kind: `dispatch-prompt`) |
| § Per-task loop, Step 6 (handle AUTO return) | `agent-message` (kind: `gate-question`/`success-return`/`failure-return`/`fixes-pushed-return`) |
| § Per-task loop, Step 8 (dispatch review) | `agent-message` (kind: `review-prompt`) |
| § Per-task loop, Step 9 (process review return) | `agent-message` (kind: `review-return`); on loop-back also `agent-message` (kind: `feedback`) |
| `answer-authority.md` answer protocol | `agent-message` (kind: `gate-answer`) |

The emission is a single shell-line atomic append at each point. Where co-emission applies (per `roadmap-format.md` § `messageKind` enum), the structural event and the sibling agent-message are two adjacent appends — POSIX guarantees each line lands intact, but the pair is not transactionally bound. The following step-specific notes detail both emissions per step.

## Per-task loop

This is the main loop. Repeat until no eligible task remains.

### Step 1: Pick the next task

- Read `roadmap.md`.
- Find tasks with `status: pending` whose every `dep` is `status: done`.
- If multiple eligible, pick the lowest `id`. (Determinism over cleverness.)
- If none eligible:
  - If pending tasks remain but none are eligible, the roadmap is **blocked** — go to "Roadmap blocked" below.
  - If no pending tasks remain, the roadmap is **complete** — go to "End of roadmap" below.

Update `state.json`:
- `currentTaskId` = picked id
- `phase = "dispatching"`
- `currentBranch` = `feat/<id>-<keys>` (derive `<keys>` from the title — kebab-case the first 3-4 significant words)
- `subAgentId` = null
- `prNumber`, `prUrl`, `currentReviewId` = null
- `fixLoopRound` = 0
- `nitFixAttempts` = 0
- `dispatchedAt`, `autoReturnedAt` = null
- `lastHaltAt`, `lastHaltQuestion` = null

   **Emit `task-start`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "dispatching" \
     --argjson taskId "$TASK_ID" \
     --arg branchKey "$CURRENT_BRANCH" \
     --argjson deps "$DEPS_JSON_ARRAY" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"task-start", branchKey:$branchKey, dependencies:$deps}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

### Step 2: Mark task in-progress on the integration branch

In the conductor worktree:

```bash
# In $WORKTREE
# Edit roadmap.md: change task <id> status from "pending" to "in-progress"
# (Preserve YAML formatting exactly — only the status value changes.)
git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/roadmap.md
git -C "$WORKTREE" commit -m "chore(conductor): start task $TASK_ID — $TASK_TITLE"
git -C "$WORKTREE" push
```

The roadmap.md update lives only on the integration branch. The main tree never sees the in-progress mutation until later when the merge cascade happens.

### Step 3: Create the per-task feat branch on the main tree

Run from the main tree (NOT the worktree):

```bash
git fetch origin "$INTEGRATION_BRANCH"
git checkout -b "$CURRENT_BRANCH" "origin/$INTEGRATION_BRANCH"
```

Verify: `git rev-parse --abbrev-ref HEAD` should print `$CURRENT_BRANCH`.

If the branch already exists locally (from a crashed prior run): use `git checkout "$CURRENT_BRANCH"` and `git status --porcelain` to inspect. If clean, proceed (re-dispatch will pick up). If dirty, halt — let the user decide.

### Step 4: Assemble the AUTO dispatch prompt

The dispatch prompt MUST begin with the literal token `AUTO:` (this is what triggers AUTO mode in the brainstorming skill). After that prefix, the prompt body contains up to five sections in this order:

1. **Task description** — copy verbatim from `roadmap.md` for this task. This is the one-line `title`; treat it as a label, not the spec.
2. **GitHub issue (authoritative source)** — **include this section IFF `idsAreIssueNumbers == true`** (per `roadmap-meta.md`, cached at Step 2). Use this exact text, with `$TASK_ID` substituted to the task's `id` (which is the GitHub issue number when this flag is true):
   > ## GitHub issue (authoritative source)
   >
   > This task corresponds to GitHub issue #`$TASK_ID`. Before you do anything else in your AUTO Step 1 exploration, run `gh issue view $TASK_ID --comments` and read the issue body and every comment. The issue may have been edited or commented on AFTER this roadmap was generated; the title above is a stale label, not the spec. **The GitHub issue body and its comments are the AUTHORITATIVE source of truth for what this task is.** If the issue's direction conflicts with the title or the dependency context, follow the issue. If the issue is closed or its acceptance criteria are unclear, return at Gate A (Step 2 clarifying) — do not guess.
3. **Dependency context** — for each dep id D in `deps`, paste the entire body of `task-D/summary.md` (after a `## Prior task summary: task <D>` heading). Read these from the conductor worktree (since main tree may not see merged summaries until a later fetch). **If `deps` is empty, omit this section entirely (do not write a heading).**
4. **Branch contract** — exact text, with `$CURRENT_BRANCH` and `$INTEGRATION_BRANCH` substituted with their actual values from `state.json` and `roadmap-meta.md` before sending (do NOT pass the literal placeholders through):
   > You are on `$CURRENT_BRANCH`, which is checked out off `$INTEGRATION_BRANCH`. All commits land on this branch. Do NOT switch branches. When you reach the implementation step's PR-creation phase via the `pull-request` skill, the PR base MUST be `$INTEGRATION_BRANCH`, NOT `main`. You MUST open the PR before returning success — returning without an open PR is a contract violation and conductor will halt.
5. **Continuation note** (only on re-dispatch — see § Re-dispatch below).

**When to omit Section 2:** if `idsAreIssueNumbers` is `false` (or absent — it defaults to `false`), there is no GitHub issue backing the `id` and the `roadmap.md` title is the only task description available. Skip Section 2 entirely; do NOT fabricate an issue number.

**Why Section 2 instructs AUTO to fetch live rather than inlining the body:** the issue may have been edited between roadmap generation and dispatch (or between dispatch and AUTO's Step 1). A live fetch guarantees AUTO sees current state plus all comments. Conductor does not snapshot the issue at dispatch time because the snapshot would itself go stale and AUTO would have no way to know whether to trust it.

**Branch-key derivation for `$CURRENT_BRANCH`:** lowercase the task title; drop stop-words (`a`, `an`, `the`, `about`, `and`, `or`, `to`, `for`, `of`, `in`, `on`); take the first 3 of the remainder; hyphen-join. So `"Add a one-line README note about the test"` → `feat/1-add-one-line-readme`. This rule is deterministic — two LLMs running the same roadmap produce the same branches.

Final prompt shape (illustrative for task 2 with deps=[1] and `idsAreIssueNumbers: true`):
```
AUTO: <task description>

## GitHub issue (authoritative source)

This task corresponds to GitHub issue #2. Before you do anything else in your AUTO Step 1 exploration, run `gh issue view 2 --comments` and read the issue body and every comment. ...

## Prior task summary: task 1

<task-1/summary.md body verbatim>

## Branch contract

You are on `feat/2-add-second-one-line`, which is checked out off `conductor/test-conductor-smoke`. All commits land on this branch. ...
```

For a roadmap with `idsAreIssueNumbers: false`, the same prompt omits the `## GitHub issue (authoritative source)` block entirely.

### Step 4.5: Verbatim construction contract (MANDATORY)

The dispatch prompt is a **literal string** assembled by section concatenation. It is NOT a description of what conductor wants AUTO to do, NOT a paraphrase of the task, NOT a narrative summary. The variable `$DISPATCH_PROMPT` referenced throughout the rest of this flow is that literal string.

**Variable legend** (used in this section's snippets):
- `$TASK_TITLE` — verbatim `title` from `roadmap.md` for the current task.
- `$TASK_ID` — current task's `id` (a GitHub issue number when `idsAreIssueNumbers: true`).
- `$IDS_ARE_ISSUE_NUMBERS` — cached at Step 2; string `"true"` or `"false"`.
- `$DEP_IDS` — space-separated list of dependency ids (may be empty).
- `$DEP_ID` — single dep id, used inside the heredoc loop body.
- `$CURRENT_BRANCH`, `$INTEGRATION_BRANCH`, `$WORKTREE`, `$ROADMAP_ID` — as elsewhere in this flow.

**Hard rules:**

1. **Build by literal heredoc, not by description.** Construct `$DISPATCH_PROMPT` like this (illustrative skeleton — substitute real values, do NOT execute as-is):
   ```bash
   DISPATCH_PROMPT=$(cat <<EOF
   AUTO: $TASK_TITLE

   ## GitHub issue (authoritative source)

   This task corresponds to GitHub issue #$TASK_ID. Before you do anything else in your AUTO Step 1 exploration, run \`gh issue view $TASK_ID --comments\` and read the issue body and every comment. The issue may have been edited or commented on AFTER this roadmap was generated; the title above is a stale label, not the spec. **The GitHub issue body and its comments are the AUTHORITATIVE source of truth for what this task is.** If the issue's direction conflicts with the title or the dependency context, follow the issue. If the issue is closed or its acceptance criteria are unclear, return at Gate A (Step 2 clarifying) — do not guess.

   ## Prior task summary: task $DEP_ID

   $(cat "$WORKTREE/docs/roadmaps/$ROADMAP_ID/task-$DEP_ID/summary.md")

   ## Branch contract

   You are on \`$CURRENT_BRANCH\`, which is checked out off \`$INTEGRATION_BRANCH\`. All commits land on this branch. Do NOT switch branches. When you reach the implementation step's PR-creation phase via the \`pull-request\` skill, the PR base MUST be \`$INTEGRATION_BRANCH\`, NOT \`main\`. You MUST open the PR before returning success — returning without an open PR is a contract violation and conductor will halt.
   EOF
   )
   # On re-dispatch only, append the Section 5 continuation note — see § Re-dispatch.
   ```
   Loop the dependency block once per `$DEP_ID` in `$DEP_IDS`. Skip the GitHub-issue block when `$IDS_ARE_ISSUE_NUMBERS != "true"`. Append the Section 5 continuation note ONLY on re-dispatch (per § Re-dispatch). The point of the heredoc is mechanical assembly — there is no creative paraphrase step.

2. **Pre-dispatch self-check (REQUIRED before Step 5; also REQUIRED on re-dispatch — see § Re-dispatch).** Before calling the Agent tool, verify the assembled string passes ALL of these checks:
   ```bash
   # Sanity backstop: a multi-section structured prompt is hundreds of bytes minimum.
   # 200 is far below any plausible real prompt (~400+ bytes for the smallest case)
   # and above any one-sentence narrative paraphrase. The structural heading checks
   # below are the primary defense; this catches absurd truncation.
   [ ${#DISPATCH_PROMPT} -ge 200 ] || { echo "FATAL: dispatch prompt absurdly short — looks paraphrased or truncated"; exit 1; }
   # Required prefix
   case "$DISPATCH_PROMPT" in
     "AUTO: "*) ;;
     *) echo "FATAL: dispatch prompt does not begin with 'AUTO: '"; exit 1 ;;
   esac
   # Required heading
   printf '%s' "$DISPATCH_PROMPT" | grep -qF "## Branch contract" \
     || { echo "FATAL: dispatch prompt missing '## Branch contract' heading"; exit 1; }
   # Required heading when idsAreIssueNumbers — separate greps so flag ordering doesn't matter
   if [ "$IDS_ARE_ISSUE_NUMBERS" = "true" ]; then
     printf '%s' "$DISPATCH_PROMPT" | grep -qF "## GitHub issue (authoritative source)" \
       || { echo "FATAL: idsAreIssueNumbers=true but '## GitHub issue (authoritative source)' heading missing"; exit 1; }
     # Match `gh issue view` and the task id independently so `--comments` flag position doesn't matter.
     printf '%s' "$DISPATCH_PROMPT" | grep -qF "gh issue view" \
       || { echo "FATAL: GitHub-issue section does not invoke 'gh issue view'"; exit 1; }
     printf '%s' "$DISPATCH_PROMPT" | grep -qE "(^|[^0-9])${TASK_ID}([^0-9]|\$)" \
       || { echo "FATAL: GitHub-issue section does not reference task id #$TASK_ID"; exit 1; }
   fi
   # Required heading per dep
   for D in $DEP_IDS; do
     printf '%s' "$DISPATCH_PROMPT" | grep -qF "## Prior task summary: task $D" \
       || { echo "FATAL: dep $D summary heading missing"; exit 1; }
   done
   ```
   If any check fails, do NOT dispatch. Re-assemble the prompt from the heredoc above; do not edit the failing prompt by hand.

3. **Same string, twice.** The `$DISPATCH_PROMPT` you pass to the `Agent` tool's `prompt` parameter at Step 5 is the same string you pass into the agent-message body field. They are not two different things — they are the same string referenced twice. Encoding note: `jq --arg body "$DISPATCH_PROMPT"` produces a properly-escaped JSON string on disk; the on-disk JSON line is not byte-identical to `$DISPATCH_PROMPT` (newlines, quotes, backslashes are escaped), but the *decoded* body round-trips exactly — `jq -r '.body' <line>` reproduces `$DISPATCH_PROMPT` byte-for-byte. Hash check: `sha256sum` of `$DISPATCH_PROMPT` (recorded as `dispatchPromptHash` in the `auto-dispatched` event) must equal `sha256sum` of `jq -r '.body' <agent-message-line>`. If they don't match, the body was paraphrased and the journal is lying.

4. **No "spirit of" substitutions.** Anti-pattern: sending the literal heredoc to AUTO but recording a one-sentence summary like `"Conductor dispatched AUTO with explicit instructions to fold the XOR CHECK constraint from #70 into the generated migration.sql, the recommended --create-only workflow…"` in the agent-message body. That exact paraphrase shape was observed in production and motivates this contract. The body field receives `$DISPATCH_PROMPT` byte-for-byte, regardless of length. Long is fine; the journal renderer handles blockquoting any length.

### Step 5: Dispatch AUTO

Use the Agent tool with `subagent_type: general-purpose` (or the harness's broadest equivalent — `claude` in FleetView; the contract is **"full tool access, no specialization"**). AUTO runs the whole brainstorm → spec → plan → code pipeline and needs unrestricted tools (Read/Edit/Write/Bash/WebFetch/Agent); specialized agent types (`Plan`, `Explore`, `hey-d:code-reviewer`, etc.) would actively limit it and break AUTO mode. Do NOT leave `subagent_type` unspecified — defaults can drift across harnesses. Capture the returned agent ID.

Update `state.json`:
- `subAgentId` = returned id
- `dispatchedAt` = now (ISO-8601)
- `phase = "auto-running"`

   **Emit `auto-dispatched`:**
   ```bash
   PROMPT_HASH=$(printf '%s' "$DISPATCH_PROMPT" | sha256sum | cut -d' ' -f1)
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "auto-running" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg dispatchPromptHash "$PROMPT_HASH" \
     --arg branchContract "$BRANCH_CONTRACT" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"auto-dispatched", subAgentId:$subAgentId, dispatchPromptHash:$dispatchPromptHash, branchContract:$branchContract}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Co-emit `agent-message` (kind: `dispatch-prompt`):**

   The `body` field is `$DISPATCH_PROMPT` **verbatim** — the same literal string passed to the `Agent` tool's `prompt` parameter above, byte-for-byte. Per Step 4.5 § rule 3, the journal body and the dispatched prompt are the same object referenced twice; do NOT paraphrase, summarize, or shorten when constructing the JSON.
   ```bash
   MSG_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "auto-running" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg body "$DISPATCH_PROMPT" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"agent-message", sender:"conductor", recipient:"auto", subAgentId:$subAgentId, messageKind:"dispatch-prompt", body:$body}')
   echo "$MSG_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   Sanity check: `dispatchPromptHash` in the `auto-dispatched` event above and `sha256sum` of this `body` field must match. If they don't, the journal is inconsistent with what was sent — investigate before continuing.

### Step 6: Handle AUTO's return

AUTO will return at one of three points. Inspect its final message to classify:

- **Success** — message contains a PR URL/number reference and "Checkpoint 3 + 3.5 passed" (or equivalent). Go to Step 7.
- **Blocking gate** — message contains a question matching one of AUTO's gate shapes (Step 2 clarifying / Gate A / Gate B). Apply `answer-authority.md`:
  - Answerable → SendMessage the answer; update `state.json` (`autoReturnedAt` set, `phase` stays `auto-running`); loop back to wait for next return.
  - Not answerable → recoverable halt: follow § Halt-to-human with `phase = "auto-blocked-on-gate"`.
- **Failure** — message indicates Checkpoint 3 or 3.5 rejected, or a hard error. Terminal halt: follow § Halt-to-human with `phase = "task-halted"` and the failure as `lastHaltQuestion`.

   **Emit `auto-returned` (always):**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "$CURRENT_PHASE" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg returnType "$RETURN_TYPE" \
     --arg returnMessageExcerpt "$(printf '%s' "$RETURN_MESSAGE" | head -c 500)" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"auto-returned", subAgentId:$subAgentId, returnType:$returnType, returnMessageExcerpt:$returnMessageExcerpt}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Co-emit `agent-message` (kind depends on `returnType`):**
   ```bash
   case "$RETURN_TYPE" in
     gate)    MSG_KIND="gate-question" ;;
     success) MSG_KIND="success-return" ;;
     failure) MSG_KIND="failure-return" ;;
     *)       MSG_KIND="failure-return" ;;  # safe default for unknown
   esac
   # If this return came after a feedback round (FIX_LOOP_ROUND > 0 and returnType is success), the kind is fixes-pushed-return:
   if [ "$RETURN_TYPE" = "success" ] && [ "$FIX_LOOP_ROUND" -gt 0 ]; then
     MSG_KIND="fixes-pushed-return"
   fi
   MSG_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "$CURRENT_PHASE" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg messageKind "$MSG_KIND" \
     --arg body "$RETURN_MESSAGE" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"agent-message", sender:"auto", recipient:"conductor", subAgentId:$subAgentId, messageKind:$messageKind, body:$body}')
   echo "$MSG_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Emit `gate-decision` (only if returnType was `gate`):** at the moment conductor decides to answer or halt (per `answer-authority.md`):
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "$CURRENT_PHASE" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg gateQuestion "$GATE_QUESTION" \
     --arg decision "$DECISION" \
     --arg groundingSource "${GROUNDING_SOURCE:-null}" \
     --arg category "$CATEGORY" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"gate-decision", subAgentId:$subAgentId, gateQuestion:$gateQuestion, decision:$decision, groundingSource:$groundingSource, category:$category}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

### Step 7: Validate the PR contract

Before moving to review:

```bash
gh pr list --head "$CURRENT_BRANCH" --base "$INTEGRATION_BRANCH" --json number,url --jq '.[0]'
```

If the result is null or empty: AUTO returned success but did NOT open the PR. This is a contract violation. Terminal halt: follow § Halt-to-human with `phase = "task-halted"` and `lastHaltQuestion = "AUTO returned success without opening the PR — contract violation"`. If the result has more than one PR matching `--head $CURRENT_BRANCH --base $INTEGRATION_BRANCH` (count > 1, e.g., a stale PR from a crashed prior run), terminal halt with `lastHaltQuestion = "Multiple open PRs match this task's branch — manual cleanup needed"`.

If the result is valid: capture `prNumber` and `prUrl`. Also extract the spec path from AUTO's success message (AUTO's report names the spec it wrote — typically `docs/specs/<date>-<slug>-design.md`). If AUTO's message does not state the path, fall back to `git -C <main-tree> log --diff-filter=A --name-only --pretty=format: "$INTEGRATION_BRANCH..$CURRENT_BRANCH" -- docs/specs/ | head -n 1`.

Update `state.json`:
- `prNumber`, `prUrl` set
- `currentSpecPath` set (captured above)
- `autoReturnedAt` = now
- `phase = "awaiting-review"`

### Step 8: Dispatch the review agent

Dispatch a fresh sub-agent (NOT a SendMessage to AUTO) with the `requesting-code-review` skill, prompt: `Review PR #<prNumber> for completeness, correctness, and conformance to the spec at <currentSpecPath>. Return must-fixes (list, may be empty) and nits (list, may be empty).`

Update `state.json`:
- `currentReviewId` = returned agent id
- `phase = "review-running"`

   **Emit `review-dispatched`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-running" \
     --argjson taskId "$TASK_ID" \
     --arg currentReviewId "$CURRENT_REVIEW_ID" \
     --argjson prNumber "$PR_NUMBER" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"review-dispatched", currentReviewId:$currentReviewId, prNumber:$prNumber}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Co-emit `agent-message` (kind: `review-prompt`):**
   ```bash
   MSG_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-running" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$CURRENT_REVIEW_ID" \
     --arg body "$REVIEW_PROMPT" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"agent-message", sender:"conductor", recipient:"review", subAgentId:$subAgentId, messageKind:"review-prompt", body:$body}')
   echo "$MSG_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

### Step 9: Process review return

Parse the review agent's return into `must-fixes` and `nits`. Then check CI:

```bash
gh pr checks "$PR_NUMBER" --watch
```

Wait for terminal state (success / failure).

Decision (depends on `fixLoopRound`, `nitFixAttempts`, must-fix status, nit status, and CI status):

- **must-fixes empty AND CI green AND nits empty** → proceed to merge (Step 10).
- **must-fixes empty AND CI green AND nits non-empty AND `nitFixAttempts < 1`** → best-effort nit round. SendMessage AUTO with a **nit-only** feedback labeled as non-blocking:
  ```
  Nits (best-effort, NOT blocking — push fixes if cheap; if not, return "skipping nits" and we'll merge as-is):
  - <nit 1>
  - <nit 2>
  ```
  Update `state.json`: `phase = "review-feedback-sent"`, `nitFixAttempts += 1`. Do NOT increment `fixLoopRound`. Loop back to await AUTO.
- **must-fixes empty AND CI green AND nits non-empty AND `nitFixAttempts >= 1`** → best-effort cap reached. Post remaining nits as a single PR comment for human follow-up, then proceed to merge (Step 10):
  ```bash
  gh pr comment "$PR_NUMBER" --body "$(printf 'Conductor merged with the following nits unaddressed after best-effort:\n\n%s' "$NITS_BULLET_LIST")"
  ```
- **`fixLoopRound < 2`, must-fixes non-empty (regardless of CI)** → SendMessage AUTO with **bundled must-fix + nit** feedback. Label the two clearly so AUTO knows which is blocking:
  ```
  Must-fix (BLOCKING — must be addressed):
  - <must-fix 1>
  - <must-fix 2>

  Nits (best-effort, address if cheap; not blocking):
  - <nit 1>
  - <nit 2>
  ```
  Loop back, increment `fixLoopRound`. Do NOT increment `nitFixAttempts` — bundled rounds do not consume the nit budget. The nit budget is reserved for the case where must-fixes are clean and only nits remain.
- **`fixLoopRound < 2`, must-fixes empty AND CI red** → SendMessage AUTO with the failing CI logs (no nits — CI red is the priority). Loop back, increment `fixLoopRound`.
- **`fixLoopRound == 2`, must-fixes empty AND CI red** → this is the **CI-flake safety round**. SendMessage AUTO asking it to push an empty no-op commit to retrigger CI (or, if AUTO declines, conductor itself runs `git -C <main-tree> commit --allow-empty -m "chore: retrigger CI" && git push`). Loop back, increment `fixLoopRound` (now 3).
- **`fixLoopRound == 2`, must-fixes non-empty** → halt. The third round is reserved for CI flake retries only; a second round of must-fixes signals the task is in trouble and needs human intervention.
- **`fixLoopRound >= 3` AND NOT success** → halt. Anything that reaches round 3 and is not the green/empty success case (must-fixes still present, or CI still red after the flake retry) is a hard stop.

When sending feedback (loop-back), update `state.json`:
- `phase = "review-feedback-sent"`
- For must-fix rounds (bundled or CI-red): `fixLoopRound += 1`
- For nit-only rounds: `nitFixAttempts += 1` (and `fixLoopRound` unchanged)

   **Emit `review-verdict` (always):**
   ```bash
   MUST_FIXES_JSON=$(printf '%s\n' "$MUST_FIXES_ARRAY" | jq -R . | jq -sc .)
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-running" \
     --argjson taskId "$TASK_ID" \
     --arg currentReviewId "$CURRENT_REVIEW_ID" \
     --argjson mustFixesCount "$MUST_FIXES_COUNT" \
     --argjson nitsCount "$NITS_COUNT" \
     --arg ciStatus "$CI_STATUS" \
     --argjson verbatimMustFixes "$MUST_FIXES_JSON" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"review-verdict", currentReviewId:$currentReviewId, mustFixesCount:$mustFixesCount, nitsCount:$nitsCount, ciStatus:$ciStatus, verbatimMustFixes:$verbatimMustFixes}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Co-emit `agent-message` (kind: `review-return`):**
   ```bash
   MSG_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-running" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$CURRENT_REVIEW_ID" \
     --arg body "$REVIEW_RETURN_BODY" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"agent-message", sender:"review", recipient:"conductor", subAgentId:$subAgentId, messageKind:"review-return", body:$body}')
   echo "$MSG_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Emit `feedback-sent` (only when SendMessaging feedback to AUTO):**

   `feedbackKind` discriminates which round this is: `"must-fix-bundled"` (must-fix list, possibly with nits bundled in), `"ci-flake"` (no-op-commit retrigger), or `"nit-only"` (best-effort nit round, must-fixes empty + CI green).
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-feedback-sent" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg feedbackBody "$FEEDBACK_BODY" \
     --arg feedbackKind "$FEEDBACK_KIND" \
     --argjson fixLoopRound "$FIX_LOOP_ROUND" \
     --argjson nitFixAttempts "$NIT_FIX_ATTEMPTS" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"feedback-sent", subAgentId:$subAgentId, feedbackBody:$feedbackBody, feedbackKind:$feedbackKind, fixLoopRound:$fixLoopRound, nitFixAttempts:$nitFixAttempts}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   **Co-emit `agent-message` (kind: `feedback`):**
   ```bash
   MSG_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "review-feedback-sent" \
     --argjson taskId "$TASK_ID" \
     --arg subAgentId "$SUB_AGENT_ID" \
     --arg body "$FEEDBACK_BODY" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"agent-message", sender:"conductor", recipient:"auto", subAgentId:$subAgentId, messageKind:"feedback", body:$body}')
   echo "$MSG_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

When halting (any `task-halted` transition above), follow § Halt-to-human (commits `halted` to `roadmap.md` and surfaces to the user with `lastHaltQuestion = "Fix-loop exceeded N rounds. Latest review: <summary>. Latest CI: <green|red>."`).

After AUTO returns from a feedback SendMessage, classify the return — but note that the **success criterion is different from Step 6's initial-dispatch criterion**. After feedback, AUTO will not emit a fresh "Checkpoint 3 + 3.5 passed" banner; instead, success looks like "fixes pushed for [list]" or simply "done, pushed" or any return that is neither a gate question nor a failure indication.

Concretely:
- If the return is a **gate question** (matches one of AUTO's gate shapes) → apply `answer-authority.md` (and route through the same answer/halt branches as Step 6).
- If the return is a **failure** (Checkpoint 3 / 3.5 rejected, or hard error) → terminal halt per § Halt-to-human.
- Otherwise treat as **success-fixes-pushed**: set `phase = "review-running"` and dispatch a fresh review agent (it has no memory of prior rounds; that's intentional), then loop back to Step 9.

### Step 10: Merge the per-task PR

Update `state.json`: `phase = "awaiting-merge"`.

```bash
gh pr merge "$PR_NUMBER" --merge   # NOT --squash; preserve commits per the user's preference
```

If merge fails with a conflict against the integration branch: halt. Update `state.json`: `phase = "task-halted"`, `lastHaltQuestion = "gh pr merge failed: <error>. Conductor does not auto-resolve conflicts."`

   **Emit `merge-decision`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "awaiting-merge" \
     --argjson taskId "$TASK_ID" \
     --argjson prNumber "$PR_NUMBER" \
     --arg result "$MERGE_RESULT" \
     --arg mergeSha "$MERGE_SHA" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"merge-decision", prNumber:$prNumber, result:$result, mergeSha:$mergeSha}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

### Step 11: Refresh the conductor worktree

The merge added commits to `$INTEGRATION_BRANCH` on the remote. The worktree is stale.

```bash
git -C "$WORKTREE" fetch origin "$INTEGRATION_BRANCH"
git -C "$WORKTREE" reset --hard "origin/$INTEGRATION_BRANCH"
```

### Step 12: Write `task-<N>/summary.md` and update `roadmap.md`

Update `state.json`: `phase = "summary-writing"`.

Inside the worktree, create `docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/`. Write `summary.md` per the shape in `roadmap-format.md`. Source material:
- `Built` — read AUTO's final return for the list of artefacts created. Cross-check against `git log $INTEGRATION_BRANCH^..$INTEGRATION_BRANCH` for the merge commit's diff.
- `Decided` — read AUTO's spec at the path AUTO returned. Extract design-decision sentences.
- `Touched` — `git diff --name-only $INTEGRATION_BRANCH^..$INTEGRATION_BRANCH`
- `Gotchas` — read AUTO's plan for any caveats; if none, write "None."

Edit `roadmap.md`: change task `<id>` status from `in-progress` to `done`.

**Emit `task-done` event** (last event for this task before flush):
```bash
EVENT_JSON=$(jq -nc \
  --arg ts "$(date -u +%FT%TZ)" \
  --arg phase "summary-writing" \
  --argjson taskId "$TASK_ID" \
  --argjson prNumber "$PR_NUMBER" \
  --arg summaryPath "docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/summary.md" \
  --arg journalPath "docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/journal.md" \
  --arg mergeSha "$MERGE_SHA" \
  '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"task-done", prNumber:$prNumber, summaryPath:$summaryPath, journalPath:$journalPath, mergeSha:$mergeSha}')
echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
```

**Flush the buffer onto the durable log:**
```bash
cat "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl" \
  >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/conductor.log.jsonl"
: > "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
```

This is idempotent. If the flush is interrupted partway (crash between cat and truncate), the next conductor session re-running this block re-appends the (now-empty if cat completed, or partial otherwise) buffer and truncates again. Worst case: a few duplicate events in `conductor.log.jsonl`, no data loss.

**Generate `task-<id>/journal.md`:**

Read this task's slice of `conductor.log.jsonl` (events with `taskId == $TASK_ID`, ordered by `ts`). Render the journal per the template documented in `roadmap-format.md` § `task-<N>/journal.md`. Concretely:

```bash
# Filter the log to this task's events
TASK_EVENTS=$(jq -c "select(.taskId == $TASK_ID)" "$WORKTREE/docs/roadmaps/$ROADMAP_ID/conductor.log.jsonl")

# Build the journal file (jq + sed; see roadmap-format.md for the exact template)
cat > "$WORKTREE/docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/journal.md" <<EOF
# Task $TASK_ID — $TASK_TITLE

**Branch:** \`$CURRENT_BRANCH\`   |   **PR:** [#$PR_NUMBER]($PR_URL) (merged at $MERGE_SHA)
**Started:** $(echo "$TASK_EVENTS" | jq -r 'select(.eventType == "task-start") | .ts' | head -1)   |   **Done:** $(echo "$TASK_EVENTS" | jq -r 'select(.eventType == "task-done") | .ts' | head -1)

## Timeline

$(echo "$TASK_EVENTS" | while read -r EV; do
  TS=$(echo "$EV" | jq -r '.ts' | cut -dT -f2 | cut -d. -f1)
  TYPE=$(echo "$EV" | jq -r '.eventType')
  case "$TYPE" in
    task-start)         echo "$TS  Picked task (branch: $(echo "$EV" | jq -r '.branchKey'))" ;;
    auto-dispatched)    echo "$TS  Dispatched AUTO (sub-agent $(echo "$EV" | jq -r '.subAgentId'))" ;;
    auto-returned)      echo "$TS  AUTO returned ($(echo "$EV" | jq -r '.returnType'))" ;;
    gate-decision)      echo "$TS  Gate decision: $(echo "$EV" | jq -r '.decision') (Category $(echo "$EV" | jq -r '.category'))" ;;
    review-dispatched)  echo "$TS  Dispatched review against PR #$(echo "$EV" | jq -r '.prNumber')" ;;
    review-verdict)     echo "$TS  Review: $(echo "$EV" | jq -r '.mustFixesCount') must-fixes, $(echo "$EV" | jq -r '.nitsCount') nits, CI $(echo "$EV" | jq -r '.ciStatus')" ;;
    feedback-sent)      echo "$TS  Sent feedback to AUTO (kind: $(echo "$EV" | jq -r '.feedbackKind // "must-fix-bundled"'); fixLoopRound=$(echo "$EV" | jq -r '.fixLoopRound'), nitFixAttempts=$(echo "$EV" | jq -r '.nitFixAttempts // 0'))" ;;
    merge-decision)     echo "$TS  Merged PR (commit $(echo "$EV" | jq -r '.mergeSha'))" ;;
    task-halted)        echo "$TS  Halted: $(echo "$EV" | jq -r '.cause')" ;;
    task-done)          echo "$TS  Wrote summary, marked done" ;;
  esac
done)

## Gate decisions

$(echo "$TASK_EVENTS" | jq -r 'select(.eventType == "gate-decision") | "- **Q:** \(.gateQuestion)\n- **A:** \(if .decision == "answer" then .groundingSource else "[halted to human]" end)\n- **Category:** \(.category)\n"' | sed '/^$/d')

## Review rounds

$(echo "$TASK_EVENTS" | jq -r 'select(.eventType == "review-verdict") | "- Round \(.fixLoopRound // 0): \(.mustFixesCount) must-fixes, \(.nitsCount) nits, CI \(.ciStatus)"')

## Conversation transcript

$(echo "$TASK_EVENTS" | jq -c 'select(.eventType == "agent-message")' | while IFS= read -r MSG; do
  TS=$(echo "$MSG" | jq -r '.ts' | cut -dT -f2 | sed 's/Z$//' | cut -d. -f1)
  SENDER=$(echo "$MSG" | jq -r '.sender')
  RECIPIENT=$(echo "$MSG" | jq -r '.recipient')
  AID=$(echo "$MSG" | jq -r '.subAgentId // "—"')
  KIND=$(echo "$MSG" | jq -r '.messageKind')
  BODY=$(echo "$MSG" | jq -r '.body')
  # Block header: agent's id rendered next to whichever side it sits on
  if [ "$SENDER" = "conductor" ]; then
    echo "### [$TS] conductor → $RECIPIENT ($AID) — $KIND"
  else
    echo "### [$TS] $SENDER ($AID) → conductor — $KIND"
  fi
  # Blockquote each body line; empty lines become bare ">"
  printf '%s\n' "$BODY" | while IFS= read -r LINE; do
    if [ -z "$LINE" ]; then echo ">"; else echo "> $LINE"; fi
  done
  echo
done)
EOF
```

If a section has zero events (no gate decisions, no review rounds), strip the heading post-hoc:
```bash
# Remove "## Gate decisions" if the section is empty
awk '/^## Gate decisions$/{flag=1; buf=$0; next} flag && /^[^[:space:]]/ && /^## / {flag=0; print buf "\n" $0; next} flag && NF==0 {next} flag {flag=0; print buf; print} !flag {print}' \
  "$WORKTREE/docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/journal.md" > /tmp/journal.cleaned
mv /tmp/journal.cleaned "$WORKTREE/docs/roadmaps/$ROADMAP_ID/task-$TASK_ID/journal.md"
# Same for ## Review rounds
# Same for ## Conversation transcript (omit heading when no agent-message events exist — e.g., v2.5 logs read by v2.6 generator)
```

(The exact awk one-liner is illustrative — implementation may use a small script or handle it inline. The contract is: empty sections are stripped.)

**Now commit everything together** (summary + journal + roadmap status flip + log flush):

```bash
git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/
git -C "$WORKTREE" commit -m "chore(conductor): complete task $TASK_ID — $TASK_TITLE"
git -C "$WORKTREE" push
```

The single commit at task-done now includes: `summary.md`, `journal.md`, `roadmap.md` (status flip), and `conductor.log.jsonl` (buffer flush). One commit per task — no extra noise on the integration branch.

Update `state.json`:
- `phase = "done"`
- Switch the main tree off the feat branch, then delete it locally:
  ```bash
  git -C <main-tree> checkout "$BASE_BRANCH"          # or any branch other than the feat branch
  git -C <main-tree> branch -D "$CURRENT_BRANCH"
  ```
  (You CANNOT delete a branch while it is checked out — git refuses with "Cannot delete branch ... checked out at <path>". The checkout must come first.)

Loop back to Step 1.

## Re-dispatch (when SendMessage fails)

If a `SendMessage` to `subAgentId` or `currentReviewId` fails with "agent not found" (or similar), the agent is gone. Recover via re-dispatch:

1. For AUTO: build a fresh dispatch prompt **using the full Step 4 + Step 4.5 procedure** (verbatim heredoc, pre-dispatch self-check, same-string-twice rule — none of these relax for re-dispatch). Append the **continuation note** as Section 5 inside the same heredoc:
   ```
   ## Continuation note

   This is a continuation of a prior interrupted run. The branch `$CURRENT_BRANCH` may already contain commits, a spec under `docs/specs/`, or a plan under `docs/plans/`. Inspect the branch state before starting; do not duplicate already-committed work. The prior run's last known halt was: `$LAST_HALT_QUESTION`.
   ```
   Re-run the Step 4.5 self-check on the assembled prompt before dispatching. The check now passes IFF the GitHub-issue and Branch-contract headings are present (the continuation note section is additive, not a replacement).

2. For Review: just re-dispatch with the same prompt. Reviews are stateless across rounds.

Update `state.json` with the new agent id. Continue the loop.

## End of roadmap

When no pending tasks remain:

1. Switch state phase to `done` (final task done).
2. Read all `task-<N>/summary.md` files in order. Build the **final PR description**:

   ```markdown
   # Roadmap: <roadmap title>

   <copy the description from roadmap.md>

   ## Tasks completed (<count>)

   ### Task 1: <title>
   <inline the entire summary>

   ### Task 2: <title>
   <...>

   ## Statistics

   - Tasks completed: <N>
   - PR commits preserved: <count from `git log --oneline $BASE_BRANCH..$INTEGRATION_BRANCH | wc -l`>
   - Spec files added: <list>
   - Plan files added: <list>
   ```

3. Open the final PR:
   ```bash
   gh pr create --base "$BASE_BRANCH" --head "$INTEGRATION_BRANCH" \
     --title "Roadmap: <roadmap title>" --body-file <description-file>
   ```

4. **Do NOT auto-merge.** This is the human's final gate.

5. Report to user:

   > Roadmap `<roadmapId>` complete. Final PR: `<url>`.
   > <count> tasks merged into `<integrationBranch>`. Awaiting your review and merge.

   **Emit `roadmap-end`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "done" \
     --arg finalPrUrl "$FINAL_PR_URL" \
     --argjson tasksCompleted "$TASKS_COMPLETED" \
     --argjson tasksHalted "$TASKS_HALTED" \
     --arg totalDuration "$TOTAL_DURATION" \
     '{ts:$ts, phase:$phase, taskId:null, eventType:"roadmap-end", finalPrUrl:$finalPrUrl, tasksCompleted:$tasksCompleted, tasksHalted:$tasksHalted, totalDuration:$totalDuration}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

   This is the FINAL event in the buffer; flush it to `conductor.log.jsonl` immediately rather than waiting for a per-task flush:

   ```bash
   cat "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/conductor.log.jsonl"
   : > "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   git -C "$WORKTREE" add "docs/roadmaps/$ROADMAP_ID/conductor.log.jsonl"
   git -C "$WORKTREE" commit -m "chore(conductor): flush roadmap-end events"
   git -C "$WORKTREE" push
   ```

6. Run worktree cleanup:
   ```bash
   git worktree remove "$WORKTREE"
   ```
   This removes the directory; the gitignored `state/` goes with it.

7. Exit the skill cleanly.

## Roadmap blocked

If pending tasks remain but none are eligible (every pending task has at least one dep that is `halted` or `failed`):

1. Surface the cascade to the user:

   > Roadmap blocked. The following pending tasks are waiting on tasks that did not complete:
   > - Task `<id>`: blocked by `<dep-id>` (status: `<halted|failed>`)
   > - …

2. Do NOT open the final PR. Do NOT clean up the worktree. The roadmap is salvageable if the user fixes the upstream task.

3. Exit. The user's recovery options:
   - Resume the upstream halted task (`conductor resume <roadmapId>`, then chase the halt)
   - Manually edit `roadmap.md` to mark a task `done` if they completed it out-of-band
   - Abort and delete the integration branch

## Halt-to-human

Conductor halts in two distinguishable modes, but both make the durable record reflect the halt by flipping `roadmap.md` to `halted`:

- **Recoverable halt** (`phase = "auto-blocked-on-gate"`) — AUTO returned a gate question conductor cannot answer per `answer-authority.md`. The task can resume with a human-supplied answer; no commits or merge state is wrong.
- **Terminal halt** (`phase = "task-halted"`) — fix-loop exhaustion, AUTO failure, contract violation, or failed merge. Resume options are narrower (typically `restart` or `abort`); the task may need re-dispatch or rollback.

Whenever a halt fires (either phase above):

1. **Update `state.json`**: set `phase` to the appropriate value (`auto-blocked-on-gate` for recoverable, `task-halted` for terminal), `lastHaltAt` = now, `lastHaltQuestion` = the verbatim halt reason or gate question.
2. **Commit `halted` to `roadmap.md`** in the conductor worktree (durable record):
   ```bash
   # Edit docs/roadmaps/$ROADMAP_ID/roadmap.md: flip task <id> status from "in-progress" to "halted"
   git -C "$WORKTREE" add docs/roadmaps/$ROADMAP_ID/roadmap.md
   git -C "$WORKTREE" commit -m "chore(conductor): halt task $TASK_ID — $REASON"
   git -C "$WORKTREE" push
   ```
   This step is identical for both halt modes — the `roadmap.md` status is the same regardless of whether the ephemeral phase is `auto-blocked-on-gate` or `task-halted`. The phase distinguishes resume strategy; the `roadmap.md` flip just records "this task is not currently progressing."
3. **Surface the halt to the user** with the message described in `answer-authority.md` § The halt protocol (for gate halts) or the equivalent text for terminal halts (failed merge, fix-loop exceeded, contract violation, AUTO failure). Include the verbatim `lastHaltQuestion` in the surface message.

   **Emit `task-halted`:**
   ```bash
   EVENT_JSON=$(jq -nc \
     --arg ts "$(date -u +%FT%TZ)" \
     --arg phase "$HALT_PHASE" \
     --argjson taskId "$TASK_ID" \
     --arg lastHaltQuestion "$LAST_HALT_QUESTION" \
     --arg cause "$HALT_CAUSE" \
     '{ts:$ts, phase:$phase, taskId:$taskId, eventType:"task-halted", lastHaltQuestion:$lastHaltQuestion, cause:$cause}')
   echo "$EVENT_JSON" >> "$WORKTREE/docs/roadmaps/$ROADMAP_ID/state/events.buffer.jsonl"
   ```

4. **Exit the turn.** On the user's next message, treat it as a directive: typically `resume`, `restart`, `abort`, or a free-form correction. The resume path in `resume-procedure.md` flips `roadmap.md` status back to `in-progress` before continuing (regardless of which halt phase preceded).

This mirroring ensures the durable `roadmap.md` accurately reflects the halted state — important for crash recovery (state.json may be lost; roadmap.md is durable on the integration branch and pushed to the remote).
