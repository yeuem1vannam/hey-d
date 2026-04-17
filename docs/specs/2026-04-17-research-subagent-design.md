# hey-d: Research Subagent

**Date:** 2026-04-17
**Status:** Draft
**Approach:** Named subagent (`agents/research.md`) opt-in callable from brainstorming, systematic-debugging, and writing-plans

## Overview

Several skills naturally hit moments where external research is needed: "how does this library handle X?", "what's the standard pattern for Y?", "is this approach feasible?". Today the main agent (Opus-tier) does it inline via WebSearch/WebFetch, which pulls raw HTML, doc dumps, and search result noise into its context. That's context pollution for work that doesn't need Opus-tier reasoning.

A dedicated research subagent takes a specific question, does the web/docs work, and returns a short synthesis with citations. Main context stays clean; cheaper model handles the lookup.

## Agent Definition

**File:** `agents/research.md`

**Model:** `sonnet` (needs synthesis judgment — filter signal from noise, spot conflicting sources, structure a readable answer; Haiku would struggle with synthesis, Opus is wasted here)

**Role description (for frontmatter):** "Use this agent for external research questions — library behavior, API shapes, standard patterns, feasibility checks. It queries the web and docs, synthesizes findings, and returns a short answer with sources. Do not use for codebase-internal questions (use Explore instead)."

**System prompt summary:**

- You answer one research question. Do not expand scope.
- Prefer authoritative sources (official docs, standards bodies) over blog posts.
- If sources conflict, name the conflict — do not pick a side silently.
- If the question is really about the user's codebase, redirect: "This looks like a codebase question. Use Explore instead."
- Cite every factual claim with a URL.
- Return a short synthesis (≤ 3 paragraphs), not a doc dump.

## Inputs

The dispatching skill passes the subagent:

- **Question** — one specific, scoped question (not "tell me about X")
- **Why it matters** (optional, short) — context about what the answer will inform. Helps the subagent focus on the relevant aspect of the topic.
- **Preferred sources / domains** (optional) — e.g. "prefer official React docs" or "only cite docs.python.org"
- **Staleness tolerance** (optional) — "must be current as of 2026" vs "any recent-ish info"

## Outputs

```
ANSWER: <2-3 paragraph synthesis>

CONFIDENCE: HIGH | MEDIUM | LOW
  <one sentence why>

SOURCES:
  - [Title](URL) — what this source contributes
  - [Title](URL) — what this source contributes

CAVEATS (optional):
  - <conflicting source, staleness warning, paywall, missing info>

SCOPE CHECK (optional):
  - <flag if the question is really about the user's codebase, not external info>
```

Confidence signal guidance:
- **HIGH**: official docs, consistent across 2+ authoritative sources
- **MEDIUM**: one strong source or multiple second-tier sources agreeing
- **LOW**: blog posts, conflicting sources, or thin coverage

## Integration

The research subagent is **opt-in per skill** — no skill becomes a hard-dependent. Callers invoke it when the question matches its purpose. Skills documenting the integration:

### `skills/brainstorming/SKILL.md`

Add a subsection to the exploration phase:

> **When to dispatch `research` subagent:** If the user's idea depends on an external library, framework, or standard you need to verify, dispatch the research subagent rather than doing web lookups inline. This keeps the design conversation clean.

### `skills/systematic-debugging/SKILL.md`

Add under hypothesis-testing:

> **When to dispatch `research` subagent:** If the bug hinges on how an external dependency behaves (library quirk, undocumented API shape, platform-specific behavior), dispatch the research subagent with a narrow question. Use its answer to inform a new hypothesis, then verify against the code.

### `skills/writing-plans/SKILL.md`

Add under file structure / approach planning:

> **When to dispatch `research` subagent:** If a task depends on a library API or framework pattern you're not 100% certain of, dispatch the research subagent to confirm before writing the plan's code snippets. Incorrect code in a plan cascades into every task that references it.

## Edge Cases

- **No answer found:** Subagent returns `CONFIDENCE: LOW` with `CAVEATS: insufficient coverage`, and a short "what I looked for and didn't find" note. Caller decides whether to proceed, ask user, or try a different approach.
- **Conflicting sources:** Both named in SOURCES, conflict noted in CAVEATS. Subagent does NOT resolve the conflict unless one source clearly supersedes (e.g., "this blog post is from 2022, official docs updated 2025").
- **Paywalled / rate-limited docs:** Subagent notes inaccessibility in CAVEATS. Does not invent content.
- **Question is actually about the codebase:** Subagent returns `SCOPE CHECK` flag and refuses to answer. Caller re-routes to Explore agent or does it inline.
- **Question too broad** ("tell me about Python"): Subagent returns a narrowing prompt: "Which aspect — syntax, libraries, a specific version change? Provide a narrower question."

## Out of Scope

- **Codebase exploration** — use Explore agent (different contract, different tools)
- **Running code** — research is read-only synthesis, not experimentation
- **Reading internal/private docs** unless the caller provides the URL explicitly
- **Long-form deep research** ("write me a report on X") — this subagent is for answering one narrow question at a time; multi-question research needs multiple dispatches

## Implementation Notes

- The research subagent uses `WebSearch` and `WebFetch`. Do not give it file-editing tools or shell access — this is a read-only role.
- Prompt the subagent to include the current year in search queries where freshness matters (Anthropic's search results are time-sensitive).
- Synthesis ≤ 3 paragraphs is a hard cap — the value is in the compression. If the answer truly needs more, the question was too broad and should be split.
- Confidence signal must be set explicitly — an answer without CONFIDENCE is a protocol violation; caller should re-dispatch.

## Relationship to Existing Agents

- **`Explore` agent (built-in):** handles codebase exploration. Research agent handles external-world questions. If unclear which applies, ask: "is the answer in our repo?" — yes → Explore; no → research.
- **`code-reviewer` agent:** does not use research agent. Code review is evidence-from-the-code, not evidence-from-the-web.
