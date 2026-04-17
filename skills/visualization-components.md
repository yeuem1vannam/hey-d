---
name: visualization-components
description: Reference catalog of the 18 hey-d visualization components. Loaded by brainstorming (visual-companion) and hey-d:visualize — tells the AI which components exist, what they do, and how to compose them.
---

# hey-d Visualization Components

18 Web Components for AI-authored visualizations (mockups, spec docs, comparisons). Shipped with the hey-d plugin at `<plugin>/resources/visualization/`. Render identically in standalone HTML, dev-server (brainstorm-server), and cloud mode.

**When the wrapper is already in place** (dev-server serving, snapshot tool, cloud page), write HTML fragments using these components. **Do NOT hand-craft HTML boilerplate** (no `<div>` with Tailwind utility soup, no custom CSS) unless composition truly needs it.

**All 18 tags are prefixed `hd-`** — one consistent naming rule, no exceptions. The Web Components spec requires a hyphen in custom element names; we use that to keep the API uniform.

## Cheat sheet (scan first)

**Layout** — page structure
- `<hd-section title="..." subtitle="...">` — page/spec section, auto h2+subtitle
- `<hd-card title="..." tag="...">` — content container; `tag` is optional badge text
- `<hd-nav title="...">` — nav bar with title
- `<hd-tabs>` + `<hd-tab label="..." active badge="...">` — tab switcher

**Content** — inline pieces
- `<hd-field label="..." size="sm|md|lg" placeholder="..." type="...">` — form input placeholder
- `<hd-stat label="..." value="..." delta="+5%">` — KPI; delta `-...` red, else green
- `<hd-tag variant="default|required|optional|accent|warning">text</hd-tag>` — label chip
- `<hd-callout variant="info|translate|note|warning" label="...">text</hd-callout>` — inline note
- `<hd-ref label="..." source="...">content</hd-ref>` — yellow source/reference panel
- `<hd-prompt label="Q1" question="...">answer slot</hd-prompt>` — prompt + answer area

**Flow** — sequential / spatial
- `<hd-steps><hd-step>text</hd-step>...</hd-steps>` — auto-numbered step list
- `<hd-flow><hd-flow-item label="..." highlight>text</hd-flow-item>...</hd-flow>` — multi-column with → arrows
- `<hd-compare label-a="..." label-b="..."><div slot="a">...</div><div slot="b">...</div></hd-compare>` — two-column
- `<hd-matrix axis-top="L|R" axis-left="T|B"><div slot="q1|q2|q3|q4">...</div></hd-matrix>` — 2×2 (q1=TR, q2=BR, q3=TL, q4=BL)

**Decision** — document alternatives
- `<hd-approach title="..." selected>content</hd-approach>` — decision option; `selected` adds ✓
- `<hd-tradeoff><ul slot="pros">...</ul><ul slot="cons">...</ul></hd-tradeoff>` — pros/cons side-by-side

**Document** — doc-level
- `<hd-toc auto>` — auto-generated from `<hd-section title>` children
- `<hd-code language="ts|json|bash|...">...</hd-code>` — native `<code>`, enhanced with dark styling

**Compose with Tailwind** for grids (`grid grid-cols-3 gap-4`), spacing (`mb-6`, `p-4`), typography (`font-semibold`) — don't invent new components.

## Quick reference — all 18 components

### 🏗 Layout (4)

- `<hd-section title="..." subtitle="...">` — top-level page/spec section. Auto-generates an `<h2>` + subtitle paragraph.
- `<hd-card title="..." tag="...">` — content container. Optional tag badge above title.
- `<hd-nav title="...">` — nav bar with title. Children are nav links.
- `<hd-tabs>` / `<hd-tab label="..." active badge="...">` — tab switcher. Put each `<hd-tab>` inside `<hd-tabs>`.

### 📝 Content (6)

- `<hd-field label="..." size="sm|md|lg" placeholder="..." type="...">` — labeled input placeholder.
- `<hd-stat label="..." value="..." delta="+5%">` — KPI / metric display. `delta` starting with `-` renders red; otherwise green.
- `<hd-tag variant="default|required|optional|accent|warning">text</hd-tag>` — label chip.
- `<hd-callout variant="info|translate|note|warning" label="...">text</hd-callout>` — inline note. `translate` variant is italic (good for EN descriptions on non-English content).
- `<hd-ref label="..." source="...">content</hd-ref>` — yellow-backgrounded reference panel. Use for source material / original-doc excerpts.
- `<hd-prompt label="Q1" question="...">content</hd-prompt>` — accent-border prompt row. Label + question render as a header; content is the answer area.

### 🔀 Flow (4)

- `<hd-steps>` containing `<hd-step>` children — auto-numbered step list.
- `<hd-flow>` containing `<hd-flow-item label="..." highlight>` children — multi-column layout with → arrows between items. `highlight` attribute gives the item a yellow accent background.
- `<hd-compare label-a="..." label-b="...">` with children `slot="a"` and `slot="b"` — two-column side-by-side.
- `<hd-matrix axis-top="Left|Right" axis-left="Top|Bottom">` with children `slot="q1|q2|q3|q4"` — 2×2 quadrant matrix. Q1 = top-right, Q2 = bottom-right, Q3 = top-left, Q4 = bottom-left (follows math-quadrant convention).

### 🧭 Decision (2)

- `<hd-approach title="..." selected>` — decision option panel. `selected` attribute marks the chosen path with a ✓ marker.
- `<hd-tradeoff>` with `<ul slot="pros">` and `<ul slot="cons">` — pros/cons side-by-side.

### 📄 Document (2)

- `<hd-toc auto>` — auto-generated table of contents. Scans all `<hd-section title="...">` in the document and builds a linked list. Use `<hd-toc>` without `auto` if you want to write entries manually.
- `<hd-code language="ts|json|bash|...">...</hd-code>` — code block with dark background, monospace, preserved whitespace. `language` attribute stored as `data-language` for future syntax-highlighting hooks.

## Composition patterns

### A spec doc (ZaPASS-style)

```html
<hd-toc auto></hd-toc>

<hd-section title="Feature F v2 — Values & Thinking Patterns" subtitle="Redesigned form with 5-column flow">

  <hd-ref label="REFERENCE — original docx (F)" source="docs/original.md">
    <h4>F ③価値観・思考の癖</h4>
    <p>Original spec text...</p>
  </hd-ref>

  <hd-card tag="BLOCK 1" title="Top 5 most fulfilling experiences">
    <hd-callout variant="translate" label="EN">
      The client lists their most fulfilling life experiences...
    </hd-callout>
    <hd-flow>
      <hd-flow-item label="経験">Experience</hd-flow-item>
      <hd-flow-item label="感情">Emotions</hd-flow-item>
      <hd-flow-item label="価値観">Values</hd-flow-item>
      <hd-flow-item label="教訓" highlight>Lesson</hd-flow-item>
      <hd-flow-item label="影響" highlight>Impact</hd-flow-item>
    </hd-flow>
  </hd-card>
</hd-section>
```

### A design decision

```html
<hd-section title="How to render the matrix">
  <hd-approach title="Path 1 — plain matrixdropdown">
    <p>Description...</p>
    <hd-tradeoff>
      <ul slot="pros"><li>Pure JSON, no code</li></ul>
      <ul slot="cons"><li>Cramped UI</li></ul>
    </hd-tradeoff>
  </hd-approach>

  <hd-approach title="Path 2 — progressive enhancement" selected>
    <p>Chosen approach description...</p>
    <hd-tradeoff>
      <ul slot="pros"><li>Reusable</li><li>Fallback-friendly</li></ul>
      <ul slot="cons"><li>One-time infra cost</li></ul>
    </hd-tradeoff>
  </hd-approach>
</hd-section>
```

### A UI mockup

```html
<hd-section title="Dashboard mockup">
  <hd-nav title="Admin Dashboard">
    <a href="#">Home</a> <a href="#">Users</a> <a href="#">Settings</a>
  </hd-nav>

  <div class="grid grid-cols-3 gap-4">
    <hd-stat label="Active users" value="1,234" delta="+5%"></hd-stat>
    <hd-stat label="Revenue" value="$12.5k" delta="-2%"></hd-stat>
    <hd-stat label="Uptime" value="99.9%"></hd-stat>
  </div>

  <hd-tabs>
    <hd-tab label="Overview" active>
      <hd-card title="System health">...</hd-card>
    </hd-tab>
    <hd-tab label="Alerts" badge="3">
      <hd-card title="Active alerts">...</hd-card>
    </hd-tab>
  </hd-tabs>
</hd-section>
```

## Composition over new components

If a pattern doesn't have a matching component, **compose existing ones with Tailwind utilities** before asking for a new one. Common compositions:

- **Grid of stats/cards:** `<div class="grid grid-cols-3 gap-4"><hd-card>...</hd-card>×N</div>`
- **Horizontal spacing in nav:** inline `style="margin-right: 1rem;"` on anchors
- **Vertical gaps between sections:** sections have built-in `--s-8` bottom margin; use `<div class="mb-6">` for finer control
- **Emphasized text:** `<strong>`, `<em>`, or Tailwind `font-semibold text-lg`
- **Tables:** plain `<table>` with border utilities. No `<hd-table>` in v1.

## Don'ts

| Don't | Do instead |
|-------|------------|
| Write `<div class="bg-white border rounded-xl p-4 mb-4">` for a card | Use `<hd-card>` — same visual, named component |
| Hand-craft field mockups: `<div class="border-dashed p-2 text-gray-500">...</div>` | Use `<hd-field label="..." size="md">` |
| Write your own yellow reference panel CSS | Use `<hd-ref label="REFERENCE" source="...">` |
| Use `<details><summary>` for collapsible sections | Not a component in v1 — use `<hd-card title="...">` for now |
| Invent new attributes on `<hd-card>` (e.g., `color="red"`) | Variants are set per-component by the library. Don't add ad-hoc attributes. |
| Use shadow DOM or `<template>` | Components are Light DOM only. Content inside a component is regular HTML. |

## Don't use for

These are out of scope for v1 — the library does not cover:

- **Architecture / data-flow diagrams** (node-edge graphs, swim lanes)
- **State machines / branching flows** (`<hd-flow>` is linear only)
- **Charts / dashboards** (no chart primitives)
- **Interactive forms** — `<hd-field>` is a visual placeholder, not a real input. For interactive specs, use plain `<input>`.

For these, fall back to raw HTML + Tailwind.

## When to use what

| Purpose | Use |
|---------|-----|
| Share a UI mockup for alignment | `<hd-card>` + `<hd-field>` + `<hd-stat>` + `<hd-tabs>` |
| Document a spec / requirement | `<hd-ref>` for sources, `<hd-callout variant="translate">` for EN notes, `<hd-flow>` for process flows, `<hd-card tag="BLOCK N">` for numbered blocks |
| Compare two designs | `<hd-compare label-a label-b>` with slots |
| Compare multiple options | `<hd-approach>` × N with `selected` on the chosen one |
| Show a 2D categorization | `<hd-matrix>` with 4 slots |
| Explain a sequential process | `<hd-steps>` for short lists, `<hd-flow>` for columnar with arrows |
| Illustrate a data structure | `<hd-code language="json">` blocks |

## Notes on native elements

- `<hd-section title="X" subtitle="Y">` — the `title` and `subtitle` attributes trigger the library to auto-insert `<h2>` and subtitle paragraph. Nest anything inside.
- `<hd-nav title="X">` — same pattern; `title` triggers a header.
- `<hd-code language="ts">` — the `language` attribute triggers the library to wrap the code in a `<pre class="code">` for syntax styling.

These work in addition to plain HTML — you can write `<hd-section>content</hd-section>` without `title` and nothing special happens.
