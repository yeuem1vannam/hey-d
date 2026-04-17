---
name: visualize
description: Use when the user asks to "visualize X", "show me a mockup of Y", "wireframe Z", or "make a spec doc for W" — produces an HTML visualization using the hd-* component library. Works standalone (no brainstorming workflow needed); for design-and-explore work use hey-d:brainstorming instead.
---

# Visualize

Produce an HTML visualization (mockup, spec doc, comparison, flow) on demand — without going through the full brainstorming workflow. Use when the user has a specific thing they want to see, not when they're still exploring what to build.

**Announce at start:** "I'm using the visualize skill to produce a visualization."

## When to use this skill vs brainstorming

| Situation | Use |
|-----------|-----|
| "I have a rough idea and want to explore/design it" | `hey-d:brainstorming` (visualize is part of that flow) |
| "I want to see [specific thing] visualized NOW" | `hey-d:visualize` (this skill) |
| "Turn this finished spec doc into a shareable HTML file" | `hey-d:visualize` in snapshot mode |
| "Show the team what the dashboard should look like" | `hey-d:visualize` for the mockup |

This is a direct-action skill — it produces a visual artifact. It does NOT design the system. If the user hasn't decided what to visualize, push back and suggest brainstorming first.

## The Process

### Step 1: Clarify

Ask at most **one short question** covering two things:

- **Kind?** (mockup / spec doc / comparison / flow / dashboard)
- **Render target?**
  - **Dev server** — for iteration. Hot reload; open in browser; good for tweaking.
  - **Standalone file** — for sharing. One self-contained HTML file; email-able.
  - **Both** — snapshot for sharing AND dev-server for iteration.

Skip this step if the user's request already answers both (e.g., "standalone wireframe of the dashboard").

### Step 2: Read the component catalog

Before writing any HTML, load the component reference:

```
Read skills/visualization-components.md
```

This catalog (18 components: `<hd-card>`, `<hd-field>`, `<hd-flow>`, `<hd-approach>`, etc.) is the source of truth for what's available and how to compose. **Do NOT hand-write `<div>` + Tailwind soup when a component exists.**

### Step 3: Write the fragment

Write an HTML fragment — content only, no `<html>`/`<head>`/`<body>` wrapper. Use hd-* components generously. Compose with Tailwind utilities where no component fits.

Save to a reasonable path:
- Dev-server mode: the brainstorm-server's `screen_dir` (provided at session start)
- Standalone mode: anywhere the user suggests, or `./visualization.html` as default

### Step 4: Produce the output per target

**For dev-server** (iteration mode):

1. Start the brainstorm-server if not already running (`skills/brainstorming/scripts/start-server.sh --project-dir <root>`) — follow the existing `hey-d:brainstorming` visual-companion launch protocol for platform-specific details.
2. Write the fragment to `<screen_dir>/<filename>.html`.
3. Tell the user the URL.

**For standalone** (sharing mode):

1. Run the snapshot tool:
   ```bash
   node <plugin>/resources/visualization/snapshot.cjs <fragment>.html --out <output>.html --title "<title>"
   ```
2. The output is a self-contained HTML file (~150-300KB) with all resources inlined — tailwind.css, theme.css, components.js, the fragment content under `<main>`.
3. Tell the user the output path.

**For both**: do the dev-server step for iteration, then produce a snapshot when the user confirms they're happy with it.

### Step 5: Iterate or hand off

Ask the user if the result looks right. If not, revise the fragment and re-push (dev-server auto-reloads; snapshot needs re-running). Once they accept, the skill is done.

## Examples

**User:** "Show me a wireframe of the admin dashboard with a users list, a revenue stat, and a nav bar."

**You:**
1. Announce: "I'm using the visualize skill..."
2. Clarify: "Dev-server to iterate, or standalone file to share?"
3. Read `skills/visualization-components.md`
4. Write fragment:

```html
<section title="Admin Dashboard">
  <nav title="Admin Dashboard">
    <a href="#">Users</a>
    <a href="#">Revenue</a>
    <a href="#">Settings</a>
  </nav>

  <div class="grid grid-cols-3 gap-4">
    <hd-stat label="Active users" value="1,234" delta="+5%"></hd-stat>
    <hd-stat label="Revenue (MTD)" value="$12.5k" delta="+8%"></hd-stat>
    <hd-stat label="Churn" value="2.1%" delta="-0.3%"></hd-stat>
  </div>

  <hd-card title="Recent users">
    <hd-field label="Filter by name" size="sm"></hd-field>
    <!-- user list placeholder -->
  </hd-card>
</section>
```

5. Push to dev-server (or snapshot per target).
6. Share URL / path.

---

**User:** "Turn the spec at `docs/specs/2026-04-17-feature-x.md` into a shareable HTML file."

**You:**
1. Announce.
2. Read the spec to understand its structure.
3. Read `skills/visualization-components.md`.
4. Write fragment using `<section>`, `<hd-ref>` for source material, `<hd-callout>` for EN/translation notes, `<hd-card tag="BLOCK N">` for numbered blocks, `<hd-flow>` for process flows, etc. — matching the spec's content.
5. Save the fragment, run snapshot tool → standalone file.
6. Share the output path.

## Red Flags — STOP

**Don't visualize without understanding what they want.** If the user says "visualize this" but you don't know what "this" refers to (or the scope is vague), ASK before writing HTML. Speculative visualization wastes everyone's time.

**Don't reinvent components.** If a pattern matches an existing hd-* component, use the component. No hand-crafted `<div class="bg-white border p-4 rounded-xl">` when `<hd-card>` exists.

**Don't skip reading the catalog.** Even if you think you know the components, the catalog has composition patterns and gotchas you shouldn't miss. Read it at Step 2, every time.

**Don't invoke brainstorming first.** This skill is the direct-action alternative. If the user explicitly asks to explore a design, redirect: "That sounds like a brainstorming question — use hey-d:brainstorming instead. Visualize is for when you already know what to show."

## Integration

**References (required reading before writing HTML):**
- `skills/visualization-components.md` — the 18-component catalog

**Uses:**
- `skills/brainstorming/scripts/server.cjs` — dev-server (for iteration mode)
- `resources/visualization/snapshot.cjs` — snapshot tool (for standalone mode)

**Not a sub-skill of:**
- `hey-d:brainstorming` — this skill stands alone. Brainstorming uses `visual-companion.md` for its own visual needs; visualize is for ad-hoc work outside that flow.

## Out of scope

- **Cloud deployment** — we produce fragments that infra teams can consume (via the portability contract in `resources/visualization/`), but this skill does not deploy to cloud. That's a separate infra responsibility.
- **Design decisions** — use `hey-d:brainstorming` if the user needs to decide what to build. This skill assumes the decision is already made.
- **Non-hd-* visual artifacts** — charts, architecture diagrams with routed arrows, state machines with branching. Not supported in v1. For those, raw HTML + external libraries.
