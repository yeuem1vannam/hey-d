# hey-d: External Researcher Subagent

**Date:** 2026-04-17
**Status:** Draft (revised after scope discussion)
**Approach:** Named subagent (`agents/external-researcher.md`) opt-in callable from brainstorming, systematic-debugging, and writing-plans

## Overview

Several skills naturally hit moments where research on non-user-code is needed: "how does this library handle X?", "what's the standard pattern for Y?", "why does this API return Z in this case?". Today the main agent (Opus-tier) does it inline — WebSearch, WebFetch, or reading `node_modules/` source — which pulls raw HTML, doc dumps, search noise, and library source into its context. Context pollution for work that doesn't need Opus-tier reasoning.

A dedicated `external-researcher` subagent takes a specific question, does the web/docs/library-source work, and returns a short synthesis with citations. Main context stays clean; Sonnet handles the synthesis.

## Scope Boundary: External = Not the User's Code

"External" is defined by **ownership**, not physical location:

- The user's own code (what they wrote, committed to their repo under their control) → **Explore** agent
- Everything else → **`external-researcher`** agent, including:
  - Web documentation (library docs sites, MDN, standards bodies)
  - Third-party library source code in `node_modules/`, vendored `vendor/` directories, Python site-packages, etc.
  - Package registries (npmjs.org, pypi.org, crates.io)
  - GitHub repos of libraries/frameworks
  - Stack Overflow, GitHub issues, community discussions

The line matters because users often ask "how does X work?" and the best answer is a mix of library docs AND the actual source code. The agent needs to move between both without being forced to dispatch twice.

## Agent Definition

**File:** `agents/external-researcher.md`

**Model:** `sonnet` — synthesis judgment is the core value (filter signal from noise, spot conflicting sources, structure a readable answer). Haiku would struggle with mixed-source synthesis; Opus is wasted here.

**Role description (for frontmatter):** "Use this agent for questions about external libraries, frameworks, APIs, standards, and patterns. It queries web/docs AND reads third-party library source (node_modules, vendored deps) as needed, then synthesizes a short answer with sources. Do NOT use for questions about the user's own code — use Explore for that."

**System prompt summary:**

- You answer one research question about code, libraries, APIs, or standards that are NOT the user's own code.
- You may search the web (WebSearch, WebFetch) AND read third-party library source in `node_modules/`, `vendor/`, site-packages, etc. (Read, Grep, Glob).
- You may NOT modify any file.
- Prefer authoritative sources: official docs > library source > Stack Overflow > blog posts.
- If official docs say X but source says Y, name the discrepancy explicitly — don't silently pick one.
- If the question is about the user's own code, refuse with `SCOPE CHECK`: "This looks like a question about your own code. Use Explore instead."
- Cite every factual claim (URL or file path).
- Synthesis ≤ 3 paragraphs. Value is in compression.

## Inputs

The dispatching skill passes:

- **Question** — one specific, scoped question (not "tell me about X")
- **Why it matters** (optional) — context about what the answer will inform. Helps the subagent focus on the relevant aspect.
- **Preferred sources** (optional) — e.g. "prefer official React docs", "only cite docs.python.org", "check node_modules/express/ source if docs are ambiguous"
- **Staleness tolerance** (optional) — "must be current as of 2026" vs "any recent-ish info"
- **Working directory** (when source-reading is expected) — repo root, so the agent knows where to look for `node_modules/` or similar

## Outputs

```
ANSWER: <2-3 paragraph synthesis>

CONFIDENCE: HIGH | MEDIUM | LOW
  <one sentence why>

SOURCES:
  - [Title](URL) — what this source contributes
  - node_modules/<pkg>/<file>:<line> — what this source contributes
  - ...

CAVEATS (optional):
  - <conflicting source, staleness warning, paywall, missing info>

SCOPE CHECK (optional):
  - <flag if the question is really about the user's own code, not external info>
```

Confidence signal guidance:
- **HIGH:** official docs AND library source agree, or 2+ authoritative sources agree
- **MEDIUM:** one strong source, or authoritative docs with no source verification
- **LOW:** blog posts, conflicting sources, thin coverage

## Tool Access

| Tool | Allowed | Why |
|------|---------|-----|
| `WebSearch` | ✓ | Find authoritative sources |
| `WebFetch` | ✓ | Read docs pages, GitHub READMEs, etc. |
| `Read` | ✓ | Read third-party library source (node_modules, vendored deps) |
| `Grep` | ✓ | Search library source for specific symbols/patterns |
| `Glob` | ✓ | Find library files by pattern |
| `Edit`, `Write` | ✗ | Read-only role |
| `Bash` | ✗ | No shell — prevents running library code, installs, etc. |
| `Task` | ✗ | No nested dispatch — single-level synthesis only |

## Integration

Opt-in per skill. No skill becomes hard-dependent — callers invoke when the question matches the agent's purpose.

### `skills/brainstorming/SKILL.md`

Add a subsection to the exploration phase:

> **When to dispatch `external-researcher`:** If the user's idea depends on a specific library, framework, API, or standard you need to verify, dispatch this subagent rather than doing web lookups inline. It can read both docs AND library source. Keeps the design conversation clean.

### `skills/systematic-debugging/SKILL.md`

Add under hypothesis-testing:

> **When to dispatch `external-researcher`:** If the bug hinges on how a third-party library behaves (undocumented API shape, quirk between docs and source, platform-specific behavior), dispatch this subagent with a narrow question. Use its answer to inform a new hypothesis, then verify against the user's code. If the answer requires reading `node_modules/<pkg>/`, mention that in the prompt so the agent knows to look there.

### `skills/writing-plans/SKILL.md`

Add under file structure / approach planning:

> **When to dispatch `external-researcher`:** If a task depends on a library API, framework pattern, or standard you're not 100% certain of, dispatch this subagent to confirm before writing the plan's code snippets. The agent can verify claims against both docs AND source. Incorrect API calls in a plan cascade into every task that references them.

## Edge Cases

- **No answer found (docs thin, source unclear):** Subagent returns `CONFIDENCE: LOW` with `CAVEATS: insufficient coverage`, plus "what I looked for and didn't find". Caller decides next step.
- **Docs and source disagree:** Both noted in SOURCES. Conflict described in CAVEATS. Subagent does NOT silently pick one — naming the discrepancy is the value. Caller decides which to trust.
- **Paywalled / rate-limited docs:** Inaccessibility noted in CAVEATS. Does not invent content.
- **node_modules not present** (e.g., user hasn't `npm install`ed): Subagent reports this in CAVEATS and answers based on docs + registry only. Does not attempt to install.
- **Question is about the user's own code:** Subagent returns `SCOPE CHECK` flag and refuses to answer. Caller reroutes to Explore.
- **Question too broad** ("tell me about Node.js"): Subagent returns a narrowing prompt asking for specificity.
- **Library not on disk AND not on web** (private/internal lib): Subagent reports insufficient access in CAVEATS. Caller provides the package docs URL or moves on.

## Out of Scope

- **Exploring the user's own code** — use Explore (different contract, different tools)
- **Running library code** — this is read-only synthesis, not experimentation. If the user needs "does `pkg.foo()` actually work?", they run it themselves.
- **Reading private/auth-required docs** unless the caller provides the URL AND the agent has access
- **Long-form deep research** ("write me a report on X") — this agent answers one narrow question at a time. Multi-question research needs multiple dispatches.
- **Installing packages** or modifying lockfiles — no Bash, no write access

## Implementation Notes

- Include the current year in search queries where freshness matters.
- Prefer library source when docs are ambiguous or silent — the actual behavior is authoritative over documentation.
- When citing library source, use the relative path (e.g. `node_modules/express/lib/router.js:42`) so the user can open it directly.
- Synthesis ≤ 3 paragraphs is a hard cap. If the answer truly needs more, the question was too broad — return a narrowing prompt instead.
- Confidence signal is mandatory. An answer without CONFIDENCE is a protocol violation; caller should re-dispatch.

## Relationship to Existing Agents

| Agent | Domain |
|-------|--------|
| **`Explore`** (built-in) | The user's own code — project source, user's own tests, user's own config |
| **`external-researcher`** (new) | Everything else — web docs, library source in `node_modules`/`vendor`, package registries, standards |
| **`completion-verifier`** | Evidence gathering (tests + requirement coverage). Does not overlap with research. |
| **`code-reviewer`** | Reviews user's code quality. Does not use research — code review is evidence-from-the-code. |

**Disambiguation rule:** "Is the answer in code the user owns?" → yes → Explore. → no → external-researcher.
