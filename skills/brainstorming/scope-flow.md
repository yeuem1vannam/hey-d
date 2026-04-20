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
