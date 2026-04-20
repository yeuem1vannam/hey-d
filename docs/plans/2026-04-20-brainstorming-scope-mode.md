# Brainstorming Scope Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth mode — **Scope mode** — to the `hey-d:brainstorming` skill, for rapidly clearing scope / DoD ambiguity without writing a spec file, branch, or plan.

**Architecture:** Mirror the existing Epic and User Story mode pattern — a new flow file loaded from `SKILL.md` on trigger match, plus three small edits to `SKILL.md` (frontmatter `description`, mode-detection table, detection-rule paragraph). No changes to other files; no tests to run (this is a markdown skill).

**Tech Stack:** Plain markdown. No runtime code. Verification is via `Read` / `Grep` for structural checks, and manual smoke testing of the skill in a fresh session.

**Spec:** [`docs/specs/2026-04-20-brainstorming-scope-mode-design.md`](../specs/2026-04-20-brainstorming-scope-mode-design.md)

---

## File Structure

- **Create:** `skills/brainstorming/scope-flow.md` — authoritative flow for Scope mode (shared prereqs, 6-item checklist, step details, follow-up menu reference, edge cases).
- **Modify:** `skills/brainstorming/SKILL.md` — frontmatter `description`, Mode-Detection table row, Detection-rule paragraph, trailing fall-through paragraph, and the "sections below do NOT apply" note.

Each file owns one concern: `scope-flow.md` is the mode's body; `SKILL.md` is the dispatcher. Follows the same separation as `epic-flow.md` and `user-story-flow.md`.

---

## Task 1: Create `scope-flow.md`

**Files:**
- Create: `skills/brainstorming/scope-flow.md`

- [ ] **Step 1: Write the new flow file**

Write `skills/brainstorming/scope-flow.md` with the full content below. This mirrors the shape of `epic-flow.md` and `user-story-flow.md`: header note, shared prerequisites, checklist, step details, hard-gate adaptation, follow-up actions reference, edge cases.

````markdown
# Brainstorming: Scope Mode

> Loaded by `skills/brainstorming/SKILL.md` when the user explicitly declares a Scope brainstorm (e.g., "SCOPE: …", "scope brainstorm", "brainstorm scope", "quick brainstorm").
>
> This file is the authoritative checklist for the rest of the session. The Task-mode checklist in SKILL.md does NOT apply when this flow is active.

## Shared prerequisites

Run these before starting the Scope-specific checklist:

1. **Code Style Config** — read `.agents/config/code-style.md` if present, following the same rule described in SKILL.md.
2. **Visual Companion** — upcoming questions in Scope mode rarely involve visual content. Only offer the companion if the user's question obviously demands a visual comparison (e.g., "which of these layouts do I mean?"). Skip otherwise.

## Checklist

Create a TodoWrite task for each item and complete them in order:

1. Read referenced context + bounded codebase scan
2. Ask 1–3 targeted clarifying questions (one per message)
3. Propose a crisp resolution
4. Get user approval on the resolution
5. Offer the follow-up menu
6. Execute the chosen follow-up action, then STOP

## Step details

### 1. Read referenced context + bounded codebase scan

Read the explicit references the user points at (ticket, spec section, file). Then run a bounded codebase scan to surface candidate touchpoints:

- A handful of targeted `Grep` queries for key symbols named in the ticket or spec.
- A `Glob` for obviously-related directories.

Budget: **do not dispatch an Explore subagent**, do not read files end-to-end. If you catch yourself doing deep reads, stop and ask a clarifying question instead. Name the candidate touchpoints in the eventual resolution (e.g., *"likely touches `X.ts`, `Y.tsx`; new file probably under `Z/`"*).

### 2. Ask 1–3 targeted clarifying questions

One question per message. Prefer multiple-choice when possible. Stop early if the answer is already clear.

Hard budget: **3 questions**. If still ambiguous after the third answer, see the Edge cases section below.

### 3. Propose a crisp resolution

The shape fits the ambiguity:

- **DoD ambiguity** → bullet list of DoD items, with likely touchpoints noted where useful.
- **Scope boundary** → `In:` and `Out:` lists.
- **Design decision** → one-paragraph decision statement plus the rejected alternative and why.

### 4. Get user approval

The whole resolution is a single gate. No section-by-section approval. Revise once or twice if needed.

### 5. Offer the follow-up menu

This is its own message, sent only after the user has approved the resolution.

> Resolution approved. Persist it?
>
> **a)** Update issue body (replace/insert DoD section)
> **b)** Post as a comment on the issue
> **c)** Both body + comment
> **d)** Write to a local file (you provide the path)
> **e)** None — I'll handle it

### 6. Execute, then STOP

Run the chosen action exactly once, confirm success to the user, and exit the skill. Do NOT invoke `writing-plans`. Do NOT create a spec file. Do NOT create a branch.

## Hard-gate adaptation

The `<HARD-GATE>` block from SKILL.md still applies, scaled down:

- Reading (`gh issue view`, `Grep`, `Glob`, `Read`) is free.
- Writing — `gh issue edit`, `gh issue comment`, file writes — is blocked until BOTH:
  - the user has approved the resolution, AND
  - the user has explicitly picked a follow-up action from the menu.

## Follow-up actions — reference

### (a) / (c) Update issue body

- Locate the DoD section by case-insensitive heading match: `## Definition of Done`, `### Definition of Done`, `## DoD`, `### DoD`. First match wins.
- If no DoD section exists: insert `### Definition of Done` near the top of the body — above any `Implementation` / `Technical Notes` section and below any `User Story` / `Goal` block.
- Only the DoD section is rewritten. If the resolution implies changes elsewhere (e.g., updated `Scope` / `Out-of-scope`), surface them as an additional diff hunk in the preview — never silently edit.
- Preview the full body diff. On `yes`, apply with:

```bash
gh issue edit <N> --repo <owner>/<repo> --body-file "$BODY_FILE"
```

### (b) / (c) Post comment

Short comment: a one-line lede stating what was clarified, followed by the resolution body.

```bash
gh issue comment <N> --repo <owner>/<repo> --body-file "$COMMENT_FILE"
```

### (d) Write to local file

The user supplies the path. Write the resolution as a plain markdown snippet — no frontmatter unless requested.

### (e) None

No-op. Exit cleanly.

## Edge cases

- **No context reference provided.** If the user invokes `SCOPE:` without pointing at anything, ask once for the target. Do not guess.
- **Referenced issue has no DoD section.** Insert a new `### Definition of Done` section at the location described under follow-up action (a). Preview the full diff before applying.
- **Existing DoD heading varies (`## DoD`, `### Definition of Done`, etc.).** Match case-insensitively on both headings; first match wins. If none match, treat as "no DoD section."
- **Question budget exhausted (3 asked, still ambiguous).** Stop and tell the user: *"Three questions in and this still needs a fuller exploration. Recommend running the full Task-mode brainstorm. I'll exit Scope mode now."* Do not silently slide into Task mode.
- **Follow-up action needs credentials the agent lacks** (e.g., `gh` unauthenticated). Surface the error, leave the resolution text in chat, exit. The resolution was never persisted — no recovery needed.
- **Resolution is not scope/DoD-shaped** (e.g., a multi-file design decision). Produce it anyway as a decision statement. In the follow-up menu, recommend option `e` so the user can feed the decision into a Task-mode brainstorm.
````

- [ ] **Step 2: Verify the file was written correctly**

Run:

```bash
Grep pattern="^# Brainstorming: Scope Mode$" path="skills/brainstorming/scope-flow.md"
Grep pattern="^## Checklist$" path="skills/brainstorming/scope-flow.md"
Grep pattern="^## Hard-gate adaptation$" path="skills/brainstorming/scope-flow.md"
Grep pattern="^## Follow-up actions — reference$" path="skills/brainstorming/scope-flow.md"
Grep pattern="^## Edge cases$" path="skills/brainstorming/scope-flow.md"
```

Expected: each pattern matches exactly once.

- [ ] **Step 3: Commit**

```bash
git add skills/brainstorming/scope-flow.md
git commit -m "feat(brainstorming): add scope-mode flow" \
  -m "Adds skills/brainstorming/scope-flow.md — the authoritative flow for Scope mode. Scope mode resolves DoD or scope ambiguity quickly (1–3 questions, crisp resolution, optional persistence via issue body / comment / local file). No spec file, no branch, no writing-plans handoff." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 2: Wire Scope mode into `SKILL.md`

**Files:**
- Modify: `skills/brainstorming/SKILL.md` (frontmatter line 3; "This skill has three modes" line 33; Mode Detection table rows 35–39; Detection rule paragraph line 43; step-3 note line 47; fall-through paragraph line 49)

- [ ] **Step 1: Update the frontmatter `description`**

Use `Edit` to replace the frontmatter `description` line.

**Old string:**
```
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Supports three modes: Task (default, produces an implementation plan), User Story (triggered by 'US:' or 'brainstorm a user story', produces a spec + GitHub issue + us/<N> branch), and Epic (triggered by 'EPIC:' or 'brainstorm an epic', produces a spec + GitHub issue + epic/<N> branch)."
```

**New string:**
```
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Supports four modes: Task (default, produces an implementation plan), User Story (triggered by 'US:' or 'brainstorm a user story', produces a spec + GitHub issue + us/<N> branch), Epic (triggered by 'EPIC:' or 'brainstorm an epic', produces a spec + GitHub issue + epic/<N> branch), and Scope (triggered by 'SCOPE:' or 'quick brainstorm', produces a crisp DoD/scope resolution in chat with optional persistence — no spec file, no plan)."
```

- [ ] **Step 2: Update the "This skill has three modes" sentence**

**Old string:**
```
This skill has three modes. The mode is chosen by the user's opening message; no confirmation is asked.
```

**New string:**
```
This skill has four modes. The mode is chosen by the user's opening message; no confirmation is asked.
```

- [ ] **Step 3: Add the Scope row to the Mode Detection table**

**Old string:**
```
| **User Story** | `brainstorm a user story`, `this is a us`, `US:`, `user story brainstorm` | `skills/brainstorming/user-story-flow.md` |
| **Task** | *(default — anything else)* | continues in this SKILL.md |
```

**New string:**
```
| **User Story** | `brainstorm a user story`, `this is a us`, `US:`, `user story brainstorm` | `skills/brainstorming/user-story-flow.md` |
| **Scope** | `SCOPE:`, `scope brainstorm`, `brainstorm scope`, `quick brainstorm` | `skills/brainstorming/scope-flow.md` |
| **Task** | *(default — anything else)* | continues in this SKILL.md |
```

- [ ] **Step 4: Update the Detection-rule paragraph**

**Old string:**
```
Scan the user's first message in the session for one of the Epic or User Story trigger phrasings above. Match case-insensitively against an explicit declaration — not a casual mention. If matched:
```

**New string:**
```
Scan the user's first message in the session for one of the Epic, User Story, or Scope trigger phrasings above. Match case-insensitively against an explicit declaration — not a casual mention. If multiple trigger phrasings would match, use priority: **Epic > User Story > Scope > Task** — planning-grade brainstorms must never be downgraded. If matched:
```

- [ ] **Step 5: Update the step-3 "does NOT apply" note**

**Old string:**
```
3. Follow that flow file as the authoritative checklist for the rest of the session. The `## Checklist` and `## Process Flow` sections below do NOT apply to Epic or User Story mode.
```

**New string:**
```
3. Follow that flow file as the authoritative checklist for the rest of the session. The `## Checklist` and `## Process Flow` sections below do NOT apply to Epic, User Story, or Scope mode.
```

- [ ] **Step 6: Update the trailing fall-through paragraph**

**Old string:**
```
If neither Epic nor User Story triggers match, continue with the Task flow (the rest of this file). The user does not need to say "Task" explicitly — it is the default.
```

**New string:**
```
If none of the Epic, User Story, or Scope triggers match, continue with the Task flow (the rest of this file). The user does not need to say "Task" explicitly — it is the default.
```

- [ ] **Step 7: Verify all edits landed**

Run each check; all should return one match:

```bash
Grep pattern="Supports four modes" path="skills/brainstorming/SKILL.md"
Grep pattern="This skill has four modes" path="skills/brainstorming/SKILL.md"
Grep pattern="\\*\\*Scope\\*\\* \\| `SCOPE:`" path="skills/brainstorming/SKILL.md"
Grep pattern="Epic > User Story > Scope > Task" path="skills/brainstorming/SKILL.md"
Grep pattern="do NOT apply to Epic, User Story, or Scope mode" path="skills/brainstorming/SKILL.md"
Grep pattern="If none of the Epic, User Story, or Scope triggers match" path="skills/brainstorming/SKILL.md"
```

Then open the file and skim the Mode Detection section for layout sanity:

```bash
Read file_path="/Users/me/Workspace/yeuem1vannam/hey-d/skills/brainstorming/SKILL.md" offset=1 limit=60
```

Expected: table renders with 4 mode rows (Epic, User Story, Scope, Task), priority note present, fall-through paragraph mentions all three non-default modes.

- [ ] **Step 8: Confirm no dangling references to "three modes"**

```bash
Grep pattern="three modes" path="skills/brainstorming/SKILL.md"
```

Expected: **no matches.**

- [ ] **Step 9: Commit**

```bash
git add skills/brainstorming/SKILL.md
git commit -m "feat(brainstorming): dispatch scope mode from SKILL.md" \
  -m "Wires up Scope mode alongside Task / Epic / User Story. Updates frontmatter description (four modes), adds Scope row to the mode-detection table, updates the detection rule paragraph with priority order (Epic > User Story > Scope > Task), and updates downstream notes that reference the previous mode set." \
  -m "Co-authored-by: Claude Opus 4.7 <ai@botfi.dev>"
```

---

## Task 3: Final cross-file consistency check

No code changes in this task — just a read-over to catch any mismatches between the two files.

- [ ] **Step 1: Confirm trigger phrasings match across the two files**

The trigger phrasings MUST be identical in both places.

```bash
Grep pattern="SCOPE:" path="skills/brainstorming/SKILL.md"
Grep pattern="SCOPE:" path="skills/brainstorming/scope-flow.md"
Grep pattern="quick brainstorm" path="skills/brainstorming/SKILL.md"
Grep pattern="quick brainstorm" path="skills/brainstorming/scope-flow.md"
```

Expected: each returns at least one match in each file; the phrases printed are the same (`SCOPE:`, `scope brainstorm`, `brainstorm scope`, `quick brainstorm`).

- [ ] **Step 2: Confirm commit log shape mirrors earlier epic/US work**

```bash
git log --oneline -6
```

Expected, top-down:
- `feat(brainstorming): dispatch scope mode from SKILL.md`
- `feat(brainstorming): add scope-mode flow`
- `docs(brainstorming): add scope-mode design spec` (from the brainstorming step)
- ... older commits ...

This mirrors the pattern of commits `a63a2e4` → `4e401c8` → `d5a2ff8` from the Epic/US work.

- [ ] **Step 3: (Optional) Manual smoke test reference**

Manual smoke tests per the spec are:

1. `SCOPE: clear the DoD of issue #X` — mode announcement + `scope-flow.md` loaded.
2. `quick brainstorm for the scope of this ticket` — same.
3. `EPIC: rework SCOPE of billing` — Epic mode wins (priority).
4. Hard-gate — no `gh issue edit` / `gh issue comment` before approval + follow-up choice.
5. Budget cap — after 3 questions, agent escalates rather than continuing.
6. No context provided — agent asks for the target once.

These require a fresh session to exercise. Skip if not convenient; the static edits above are sufficient for the plan's completion.

---

## Completion Criteria

- [ ] `skills/brainstorming/scope-flow.md` exists with the seven top-level sections: title blockquote, Shared prerequisites, Checklist, Step details, Hard-gate adaptation, Follow-up actions — reference, Edge cases.
- [ ] `skills/brainstorming/SKILL.md` references four modes (not three), has the Scope row in the Mode Detection table, states the priority order explicitly, and every downstream sentence that enumerates non-Task modes includes Scope.
- [ ] Two commits land in order: `feat(brainstorming): add scope-mode flow`, then `feat(brainstorming): dispatch scope mode from SKILL.md`.
- [ ] No "three modes" string remains in `SKILL.md`.
