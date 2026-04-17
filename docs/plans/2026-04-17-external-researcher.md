# External Researcher Subagent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sonnet-tier `external-researcher` subagent that answers narrow questions about third-party code and external knowledge (web docs, library source in `node_modules/`, package registries), returning short synthesized answers with sources. Wire it as opt-in from three skills (brainstorming, systematic-debugging, writing-plans).

**Architecture:**
1. NEW `agents/external-researcher.md` — named subagent (Sonnet, read-only, has Read/Grep/Glob/WebSearch/WebFetch; no Edit/Write/Bash/Task)
2. MODIFY three skills to add a "When to Dispatch external-researcher" subsection — no hard dependency, opt-in per question

No caller changes beyond the three new subsections. No code, no tests — markdown only.

**Tech Stack:** Markdown only.

---

## File Map

| File | Change |
|------|--------|
| `agents/external-researcher.md` | CREATE — agent definition (frontmatter + system prompt) |
| `skills/brainstorming/SKILL.md` | MODIFY — add "When to Dispatch external-researcher" section |
| `skills/systematic-debugging/SKILL.md` | MODIFY — add "When to Dispatch external-researcher" section |
| `skills/writing-plans/SKILL.md` | MODIFY — add "When to Dispatch external-researcher" section |

---

### Task 1: Create `agents/external-researcher.md`

**Files:**
- Create: `agents/external-researcher.md`

- [ ] **Step 1: Write the agent definition file**

Create `agents/external-researcher.md` with exactly this content:

````markdown
---
name: external-researcher
description: Use this agent for questions about external libraries, frameworks, APIs, standards, and patterns. It queries web/docs AND reads third-party library source (node_modules, vendored deps, site-packages) as needed, then synthesizes a short answer with sources. Do NOT use for questions about the user's own code — use Explore for that.
model: sonnet
---

You are an external-researcher. You answer one research question about code, libraries, APIs, or standards that are NOT the user's own code. Your value is compression — a short synthesis with citations, not a doc dump.

## Scope: External = Not the User's Code

You operate on everything that is NOT code the user wrote themselves:

- Web documentation (library docs sites, MDN, standards bodies)
- Third-party library source in `node_modules/`, `vendor/`, site-packages, etc.
- Package registries (npmjs.org, pypi.org, crates.io)
- GitHub repos of libraries/frameworks
- Stack Overflow, GitHub issues, community discussions

You do NOT answer questions about the user's own code. If the question is about their code, refuse with a `SCOPE CHECK` flag and tell them to use Explore.

## Tool Access

You may use:
- `WebSearch`, `WebFetch` — external research
- `Read`, `Grep`, `Glob` — read third-party library source on disk

You may NOT use:
- `Edit`, `Write`, `Bash`, `Task`

You are read-only. You never modify files. You never run code. You never dispatch other agents.

## Your Inputs

The caller provides:

- **Question** — one specific, scoped question
- **Why it matters** (optional) — helps you focus on the relevant aspect
- **Preferred sources** (optional) — e.g. "prefer official React docs", "check node_modules/express/ source"
- **Staleness tolerance** (optional) — how current the answer must be
- **Working directory** (when source-reading is expected) — so you can find `node_modules/` or similar

If the question isn't specific enough (e.g., "tell me about Node.js"), return a narrowing prompt instead of a half-answer.

## Your Job

1. **Search for authoritative sources first.** Priority: official docs > library source > reputable tutorials > Stack Overflow > blog posts.
2. **Cross-check when it matters.** If docs are ambiguous or behavior seems surprising, read the actual library source. If source is available on disk (`node_modules/`, etc.), prefer that over GitHub web views for speed.
3. **Name discrepancies.** If docs say X and source says Y, do NOT silently pick one. Report in CAVEATS.
4. **Synthesize.** ≤ 3 paragraphs. Short, structured, high-density.
5. **Cite every factual claim.** URL for web sources, `path:line` for source files.

## Report Format

```
ANSWER: <2-3 paragraph synthesis>

CONFIDENCE: HIGH | MEDIUM | LOW
  <one sentence why>

SOURCES:
  - [Title](URL) — what this source contributes
  - node_modules/<pkg>/<file>:<line-range> — what this source contributes

CAVEATS (optional):
  - <conflicting source, staleness warning, paywall, missing info>

SCOPE CHECK (optional, if question is about user's own code):
  - This looks like a question about your own code. Use Explore instead.
```

### Confidence Rules

- **HIGH:** official docs AND library source agree, or 2+ authoritative sources agree
- **MEDIUM:** one strong source, or authoritative docs with no source verification
- **LOW:** blog posts, conflicting sources, thin coverage

Confidence must ALWAYS be set. An answer without CONFIDENCE is a protocol violation.

## Freshness

Include the current year in search queries where freshness matters. If a source is clearly stale (deprecated API version, outdated library version), note it in CAVEATS even if the content is correct in spirit.

## Synthesis Discipline

≤ 3 paragraphs is a hard cap. The value is compression.

- If you truly need more, the question was too broad — return a narrowing prompt.
- Prefer structure (short paragraphs, each doing one job) over prose flow.
- Skip preamble: no "Great question!", no "Let me explain...", no restating the question.

## What You Are NOT

- You are NOT the Explore agent. You do not answer questions about the user's own code.
- You are NOT a code writer. You do not produce fixes or implementations.
- You are NOT a runner. You do not execute code to check behavior.
- You are NOT a multi-question agent. One question per dispatch.
````

IMPORTANT: The triple-backtick fences inside the file (around the Report Format block) must be regular triple-backticks. The quadruple backticks above are only so this instruction can contain the full markdown. In the file, use triple-backticks.

- [ ] **Step 2: Verify the file**

Run: `head -5 agents/external-researcher.md`
Expected: frontmatter with `name: external-researcher`, `description: Use this agent...`, `model: sonnet`

Run: `wc -l agents/external-researcher.md`
Expected: approximately 85-100 lines

Run: `grep -c "^##" agents/external-researcher.md`
Expected: at least 9 headers (Scope, Tool Access, Your Inputs, Your Job, Report Format, Confidence Rules, Freshness, Synthesis Discipline, What You Are NOT)

- [ ] **Step 3: Commit**

```bash
git add agents/external-researcher.md
git commit -m "feat(agents): add external-researcher subagent for library and docs research" -m "Sonnet-tier read-only agent that answers narrow questions about external libraries, frameworks, and standards. Can search web/docs AND read third-party library source in node_modules, vendored deps, and site-packages. Returns short synthesis (<= 3 paragraphs) with sources and confidence signal." -m "Scope boundary: external = not the user's code. Pairs with Explore (which handles the user's own code)." -m "Plan: docs/plans/2026-04-17-external-researcher.md (Task 1)" -m "Co-authored-by: Claude Haiku 4.5 <ai@botfi.dev>"
```

---

### Task 2: Add "When to Dispatch" blocks to three caller skills

**Files:**
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/systematic-debugging/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`

Each skill gets a new `## When to Dispatch external-researcher` section with skill-specific guidance. No existing content is removed.

- [ ] **Step 1: Add section to `skills/brainstorming/SKILL.md`**

Insert a new `## When to Dispatch external-researcher` section **after `## After the Design`** and **before `## Key Principles`**. Content:

```markdown
## When to Dispatch external-researcher

During the exploration phase, if the user's idea depends on a specific library, framework, API, or standard you need to verify, dispatch the `external-researcher` subagent (`agents/external-researcher.md`) rather than doing web lookups inline. The agent can read both docs AND library source (node_modules, vendored deps), and returns a short synthesis with sources and a confidence signal.

**When to use it:**
- "How does library X handle Y?" — verify assumptions before designing around them
- "Is there a standard for Z?" — check before proposing an ad-hoc design
- "What's the current best practice for N?" — external context the user may not have

**When NOT to use it:**
- Questions about the user's own code → use Explore instead
- Opinion/judgment calls ("should we use library X or Y?") — the agent cites, it does not decide
- Long-form reports or multi-topic surveys — the agent answers one narrow question per dispatch

Keeps the design conversation clean of raw docs and search noise.
```

Verify insertion: `grep -n "## When to Dispatch external-researcher" skills/brainstorming/SKILL.md`
Expected: one match, line number between the lines of `## After the Design` and `## Key Principles`.

- [ ] **Step 2: Add section to `skills/systematic-debugging/SKILL.md`**

Insert a new `## When to Dispatch external-researcher` section **after `## The Four Phases`** and **before `## Red Flags - STOP and Follow Process`**. Content:

```markdown
## When to Dispatch external-researcher

During hypothesis-testing (Phase 2 or Phase 3), if the bug hinges on how a third-party library behaves — an undocumented API shape, a quirk between docs and source, platform-specific behavior — dispatch the `external-researcher` subagent (`agents/external-researcher.md`).

Give it a narrow question with context about the observed behavior. If the answer requires reading the library source on disk, say so explicitly in the prompt (e.g., "check node_modules/express/lib/router.js for how this middleware is ordered"). The agent will cross-check docs against source and report discrepancies in CAVEATS.

**Typical prompts:**
- "Does library X's `foo()` method swallow errors in its async path? Docs are ambiguous; check node_modules/X/ source."
- "What's the actual HTTP status code when <framework> hits a request timeout? Spec vs source disagree."

Use the agent's answer to form a new hypothesis, then verify against the user's own code — that verification is back in your territory, not the research agent's.

**When NOT to use it:**
- Questions about the user's own code → that's part of debugging, not research
- "Why is MY code broken?" — if the answer lives in user code, the root cause is there, not in a library
```

Verify insertion: `grep -n "## When to Dispatch external-researcher" skills/systematic-debugging/SKILL.md`
Expected: one match, line number between `## The Four Phases` and `## Red Flags - STOP and Follow Process`.

- [ ] **Step 3: Add section to `skills/writing-plans/SKILL.md`**

Insert a new `## When to Dispatch external-researcher` section **after `## Scope Check`** and **before `## File Structure`**. Content:

```markdown
## When to Dispatch external-researcher

If a task in the plan depends on a library API, framework pattern, or standard you're not 100% certain of, dispatch the `external-researcher` subagent (`agents/external-researcher.md`) to confirm BEFORE writing the plan's code snippets.

Why this matters: incorrect API calls, wrong type signatures, or imagined methods in a plan cascade into every task that references them. The cost of verifying upfront is small; the cost of discovering the mistake mid-execution is every dependent task needing revision.

**Typical prompts:**
- "Does `<library>.<method>` take an options object as the second argument or a callback? Plan uses it in Task 3."
- "Is `<framework>`'s hook `useX` still the recommended API as of <year>, or has it been deprecated?"
- "What's the exact shape of the response from `<API>`'s `/<endpoint>` endpoint? Need it to write the type."

Dispatch for any claim you'd be embarrassed to have wrong in a written plan. Use the agent's answer to ground the code snippets in your tasks.

**When NOT to use it:**
- Questions about the user's own code — you should have that context from brainstorming's spec
- Design decisions — the plan captures decisions already made, it doesn't make them
```

Verify insertion: `grep -n "## When to Dispatch external-researcher" skills/writing-plans/SKILL.md`
Expected: one match, line number between `## Scope Check` and `## File Structure`.

- [ ] **Step 4: Sanity-check no existing content was removed**

Run: `git diff --stat skills/brainstorming/SKILL.md skills/systematic-debugging/SKILL.md skills/writing-plans/SKILL.md`

Each file should show insertions only, no deletions (or near-zero deletions — only possible if a trailing newline got normalized).

- [ ] **Step 5: Commit**

```bash
git add skills/brainstorming/SKILL.md skills/systematic-debugging/SKILL.md skills/writing-plans/SKILL.md
git commit -m "feat(skills): wire external-researcher opt-in from brainstorming, systematic-debugging, writing-plans" -m "Adds a 'When to Dispatch external-researcher' section to each of the three skills that commonly hit external-knowledge questions. Opt-in per question — no hard dependency." -m "Each section includes skill-specific when-to-use, when-NOT-to-use guidance, and example prompts. Boundary vs. Explore is explicit: external-researcher handles not-the-user's-code; Explore handles the user's own code." -m "Plan: docs/plans/2026-04-17-external-researcher.md (Task 2)" -m "Co-authored-by: Claude Haiku 4.5 <ai@botfi.dev>"
```

---

### Task 3: Manual validation

This is a runtime smoke test, not automated. Confirms the agent's report format matches spec.

**Files:**
- None modified (unless format issues found — then `agents/external-researcher.md`)

- [ ] **Step 1: Dispatch the agent with a web-only question**

Invoke Task tool with `subagent_type: external-researcher`:

```
QUESTION: What is the default timeout for fetch() in browsers as of 2026? Is it different in Node.js's built-in fetch?

WHY IT MATTERS: Writing a plan that relies on fetch timeout behavior.

PREFERRED SOURCES: MDN, whatwg spec, Node.js official docs.

STALENESS: must be current as of 2026.

WORKING DIRECTORY: /Users/me/Workspace/yeuem1vannam/hey-d
```

Confirm the report has:
- `ANSWER:` section (≤ 3 paragraphs)
- `CONFIDENCE:` set to HIGH/MEDIUM/LOW with one-sentence reason
- `SOURCES:` with URL citations
- No `SCOPE CHECK` (not a user-code question)
- No `CAVEATS` unless there's a real ambiguity to flag

- [ ] **Step 2: Dispatch with a library-source question (if node_modules available; otherwise skip)**

If `node_modules/` is present in the working directory, dispatch a question that requires reading source:

```
QUESTION: How does express's default error handler format the response body?

WHY IT MATTERS: Verifying an assumption about error format before writing a middleware.

PREFERRED SOURCES: check node_modules/express/ source, fall back to docs.

WORKING DIRECTORY: <any-project-with-express-installed>
```

Confirm report cites `node_modules/express/...:line` in SOURCES.

Since hey-d's own repo doesn't have express installed, this step is optional. Skip if no suitable project available.

- [ ] **Step 3: Dispatch with a user-code question (scope boundary test)**

Invoke:

```
QUESTION: What does the brainstorming skill's visual-companion.md file contain? Explain its role in the brainstorming workflow.

WORKING DIRECTORY: /Users/me/Workspace/yeuem1vannam/hey-d
```

Confirm the agent **refuses** with a `SCOPE CHECK` flag saying this is a user-code question and pointing to Explore. This is a test of the scope boundary — the agent should NOT answer even though the file is readable.

- [ ] **Step 4: If format deviates in any dispatch, tweak and commit**

If Step 1/2/3 reveal format issues (missing CONFIDENCE, no SOURCES, wrong SCOPE CHECK behavior), update `agents/external-researcher.md`:

```bash
git add agents/external-researcher.md
git commit -m "fix(agents/external-researcher): refine prompt after manual validation"
```

If all three dispatches produce correct format, no commit needed.

---

## Notes for the Implementer

- This plan produces no code — only markdown. No TDD cycle.
- The agent is opt-in; no existing skill is forced to use it. Integration is three new subsections, not rewrites.
- Task 3's user-code scope test (Step 3) is the most interesting — confirms the agent refuses to step on Explore's territory. If it answers instead of returning `SCOPE CHECK`, the system prompt needs strengthening.
- Do NOT modify callers' existing content. Only add the new `## When to Dispatch external-researcher` section to each.
- If a skill's structure makes the specified insertion point awkward (e.g., a subsection appears where the plan expected an H2), use your judgment for placement — the goal is the section exists and is discoverable, exact line is secondary.

---

## Release

After all tasks complete and validated, no release yet — will be bundled with the completion-verifier release as `5.0.7-d.4` (both agents in one release).

Commits only on the `hey-d` branch. Do not push or tag in this plan.
