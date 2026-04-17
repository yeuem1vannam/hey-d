# Visualization Library & Infrastructure Implementation Plan (Part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use hey-d:subagent-driven-development (recommended) or hey-d:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 18-component hey-d visualization library plus the rendering infrastructure (wrapper template, snapshot tool, brainstorm-server route extensions) so that AI-authored HTML fragments render correctly across standalone, dev-server, and cloud-ready modes.

**Architecture:** Files shipped under `<plugin>/resources/visualization/`. Web Components in Light DOM; all tags unprefixed. Tailwind for utilities (CDN in dev-server, pre-built bundle for standalone). Brainstorm-server extended with new routes to serve plugin resources + optional project overrides.

**Scope for this plan:** Library + infrastructure only. Skill integration (visualization-components.md, visual-companion update, hey-d:visualize) is in Plan 2.

**Tech Stack:** Vanilla JS (ES modules), CSS with custom properties, Tailwind CSS (pre-built pruned output), Node.js for snapshot tool, existing brainstorm-server (zero-dep Node).

---

## File Map

| File | Change |
|------|--------|
| `resources/visualization/theme.css` | CREATE — CSS variables + baseline component styles |
| `resources/visualization/components.js` | CREATE — 18 Web Components in one file, organized by category |
| `resources/visualization/tailwind.css` | CREATE — pre-built Tailwind output (pruned) |
| `resources/visualization/wrapper.html` | CREATE — wrapper template with `{{title}}` / `{{content}}` placeholders |
| `resources/visualization/snapshot.js` | CREATE — Node.js tool: fragment → standalone HTML |
| `resources/visualization/snapshot.sh` | CREATE — bash wrapper around `snapshot.js` |
| `resources/visualization/examples/gallery.html` | CREATE — one of each component for visual testing |
| `resources/visualization/build-tailwind.sh` | CREATE — rebuild tailwind.css from current components (dev-only) |
| `tests/brainstorm-server/server.js` | MODIFY — add routes for `/resources/visualization/*` and `/.agents/config/visualization/*` |
| `tests/brainstorm-server/frame-template.html` | REPLACE — with new `wrapper.html` or adapt structure |
| `tests/brainstorm-server/visualization-routes.test.js` | CREATE — tests for new routes + fallback behavior |
| `tests/brainstorm-server/snapshot.test.js` | CREATE — smoke tests for snapshot.js |

---

### Task 1: Create `theme.css` (CSS variables + baseline styles)

**Files:**
- Create: `resources/visualization/theme.css`

- [ ] **Step 1: Write the stylesheet**

Create `resources/visualization/theme.css` with CSS custom properties (themeable via override) and baseline component selectors:

```css
/* =========================================================================
   hey-d visualization theme
   ========================================================================= */

:root {
  /* Colors (project override-able via .agents/config/visualization/theme.css) */
  --bg:        #F0F4F4;
  --fg:        #1f2f2f;
  --muted:     #4b5e5e;
  --accent:    #0E3B3B;
  --accent-2:  #4A8A5F;
  --card:      #fff;
  --card-border: #E8EDED;
  --ref-bg:    #FAF7EE;
  --ref-border:#E5D9A8;
  --ref-label-bg:#C9A227;
  --callout-bg:#EAF2EC;
  --callout-border:#4A8A5F;
  --warning-bg:#FFF3DD;
  --warning-border:#E89B3A;

  /* Spacing */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-8: 56px;

  /* Radii */
  --r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-xl: 14px;
}

/* Page basics */
html, body {
  margin: 0; padding: 0;
  background: var(--bg); color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
  font-size: 15px; line-height: 1.55;
}
main { display: block; max-width: 1180px; margin: 0 auto; padding: 32px; }

/* ============================ Components ============================ */

/* section */
section[title] { margin-bottom: var(--s-8); padding-top: var(--s-4); }
section[title]:not(:first-of-type) { border-top: 4px solid var(--accent); }

/* card */
card {
  display: block;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  margin-bottom: var(--s-4);
}

/* tag */
tag {
  display: inline-block;
  font-size: 0.68rem;
  padding: 3px 10px;
  border-radius: var(--r-sm);
  letter-spacing: 0.04em;
  font-weight: 600;
  background: var(--accent);
  color: #fff;
}
tag[variant="required"] { background: #E75A5A; }
tag[variant="optional"] { background: #8a9a9a; }
tag[variant="accent"]   { background: var(--accent-2); }
tag[variant="warning"]  { background: var(--warning-border); color: #fff; }

/* callout */
callout {
  display: block;
  background: var(--callout-bg);
  border-left: 3px solid var(--callout-border);
  border-radius: var(--r-sm);
  padding: var(--s-2) var(--s-3);
  font-size: 0.85rem;
  margin: var(--s-2) 0 var(--s-3);
}
callout[variant="translate"] { font-style: italic; color: #2f5a3a; }
callout[variant="warning"] { background: var(--warning-bg); border-color: var(--warning-border); }

/* ref */
ref {
  display: block;
  background: var(--ref-bg);
  border: 1px solid var(--ref-border);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  margin-bottom: var(--s-4);
  font-size: 0.85rem;
}

/* field */
field {
  display: block;
  background: #F6F8F8;
  border: 1px dashed #cfd7d7;
  border-radius: var(--r-sm);
  padding: var(--s-3);
  font-size: 0.78rem;
  color: #7b8a8a;
  margin: var(--s-2) 0;
}
field[size="sm"] { min-height: 48px; }
field[size="md"] { min-height: 72px; }
field[size="lg"] { min-height: 120px; }

/* stat */
stat {
  display: inline-block;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-4);
  min-width: 140px;
}

/* flow */
flow { display: grid; gap: var(--s-2); align-items: center; }
flow-item { background: #F6F8F8; border: 1px dashed #cfd7d7; border-radius: var(--r-sm); padding: var(--s-2); font-size: 0.75rem; }
flow-item[highlight] { background: #FFFBEC; border-color: #F2D474; }

/* compare */
compare { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4); }

/* matrix */
matrix { display: grid; grid-template-columns: 80px 1fr 1fr; gap: var(--s-2); }

/* approach */
approach {
  display: block;
  background: #F6F8F8;
  border: 1px solid #cfd7d7;
  border-radius: var(--r-md);
  padding: var(--s-4) var(--s-5);
  margin: var(--s-3) 0;
  font-size: 0.85rem;
}
approach[selected] { border-color: var(--accent-2); background: #F2F8F3; }

/* tradeoff */
tradeoff { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); margin-top: var(--s-2); }

/* code */
code[language], pre.code {
  display: block;
  background: var(--accent);
  color: #C7E8DB;
  border-radius: var(--r-md);
  padding: var(--s-4);
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
  overflow-x: auto;
}

/* tabs */
tabs { display: block; }
tab { display: none; }
tab[active] { display: block; }

/* toc */
toc {
  display: block;
  background: #fff;
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: var(--s-4) var(--s-5);
  margin-bottom: var(--s-5);
}
```

- [ ] **Step 2: Verify file**

Run: `wc -l resources/visualization/theme.css` — expected: ~120-140 lines
Run: `grep -c "^[a-z].*{" resources/visualization/theme.css` — expected: at least 18 selector blocks (one per component minimum)

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/theme.css
git commit -m "feat(visualization): add theme.css with CSS variables and baseline component styles" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 1)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 2: Create `components.js` — layout category (4 components)

**Files:**
- Create: `resources/visualization/components.js`

- [ ] **Step 1: Write file header and layout components**

Create `resources/visualization/components.js` with header comment and the 4 layout Web Components:

```javascript
/**
 * hey-d visualization components — Web Components library
 *
 * 18 components in 5 categories:
 *   Layout (4):   section, card, nav, tabs/tab
 *   Content (6):  field, stat, tag, callout, ref, prompt
 *   Flow (4):     steps/step, flow/flow-item, compare, matrix
 *   Decision (2): approach, tradeoff
 *   Document (2): toc, code
 *
 * All components use Light DOM (no shadow), so parent styles apply normally.
 * Distributed as a single file for easy inlining in standalone snapshots.
 */

(() => {
  'use strict';

  // ================== LAYOUT ==================

  class HeydSection extends HTMLElement {
    connectedCallback() {
      const title = this.getAttribute('title');
      const subtitle = this.getAttribute('subtitle');
      if (title && !this.querySelector(':scope > h2.section-title')) {
        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.textContent = title;
        this.prepend(h2);
      }
      if (subtitle && !this.querySelector(':scope > p.section-subtitle')) {
        const p = document.createElement('p');
        p.className = 'section-subtitle';
        p.textContent = subtitle;
        this.insertBefore(p, this.children[1] || null);
      }
    }
  }
  customElements.define('section-x', HeydSection); // Note: <section> already exists; use as-is via attributes

  // Actually, <section> is a native HTML5 element. We attach behavior by registering
  // a customized built-in via `is="hey-d-section"` — but for simplicity, we let
  // authors use native <section title="..."> and rely on CSS + a MutationObserver
  // that adds the h2 on connect.

  // Simpler approach: use MutationObserver to decorate native <section> tags
  // with title/subtitle attributes instead of defining a new element.

  const sectionObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && node.tagName === 'SECTION' && node.hasAttribute('title')) {
          decorateSection(node);
        }
      }
    }
  });

  function decorateSection(el) {
    if (el.dataset.heydDecorated) return;
    el.dataset.heydDecorated = '1';
    const title = el.getAttribute('title');
    const subtitle = el.getAttribute('subtitle');
    if (title) {
      const h2 = document.createElement('h2');
      h2.className = 'section-title';
      h2.textContent = title;
      el.prepend(h2);
    }
    if (subtitle) {
      const p = document.createElement('p');
      p.className = 'section-subtitle';
      p.textContent = subtitle;
      el.insertBefore(p, el.children[1] || null);
    }
  }

  // Decorate existing sections on load
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('section[title]').forEach(decorateSection);
    sectionObserver.observe(document.body, { childList: true, subtree: true });
  });

  // <card> — content container with optional tag + title
  class HeydCard extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const tag = this.getAttribute('tag');
      const title = this.getAttribute('title');
      if (tag) {
        const el = document.createElement('tag');
        el.textContent = tag;
        this.prepend(el);
      }
      if (title) {
        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.className = 'card-title';
        const insertAt = tag ? this.children[1] : this.firstChild;
        this.insertBefore(h3, insertAt || null);
      }
    }
  }
  customElements.define('card', HeydCard);

  // <nav> — use native <nav> with optional decoration
  class HeydNav extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const title = this.getAttribute('title');
      if (title) {
        const h1 = document.createElement('h1');
        h1.className = 'nav-title';
        h1.textContent = title;
        this.prepend(h1);
      }
    }
  }
  // nav is native; register a customized built-in so authors can use <nav title="My App">
  // We'll use a class and decorator approach similar to section above.

  // For simplicity and v1, we use a custom element <heyd-nav> that wraps nav semantics.
  // Authors write <nav title="..."> and a MutationObserver decorates.

  const navObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && node.tagName === 'NAV' && node.hasAttribute('title')) {
          decorateNav(node);
        }
      }
    }
  });

  function decorateNav(el) {
    if (el.dataset.heydDecorated) return;
    el.dataset.heydDecorated = '1';
    const title = el.getAttribute('title');
    if (title) {
      const h1 = document.createElement('h1');
      h1.className = 'nav-title';
      h1.textContent = title;
      el.prepend(h1);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('nav[title]').forEach(decorateNav);
    navObserver.observe(document.body, { childList: true, subtree: true });
  });

  // <tabs> + <tab>
  class HeydTabs extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const tabs = this.querySelectorAll(':scope > tab');
      const bar = document.createElement('div');
      bar.className = 'tab-bar';
      tabs.forEach((tab, i) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (tab.hasAttribute('active') ? ' active' : '');
        btn.textContent = tab.getAttribute('label') || `Tab ${i + 1}`;
        const badge = tab.getAttribute('badge');
        if (badge) {
          const b = document.createElement('span');
          b.className = `badge badge-${badge}`;
          b.textContent = badge;
          btn.prepend(b);
        }
        btn.addEventListener('click', () => this.activate(i));
        bar.appendChild(btn);
      });
      this.prepend(bar);
      // Ensure exactly one active
      if (!this.querySelector('tab[active]')) {
        tabs[0]?.setAttribute('active', '');
        bar.children[0]?.classList.add('active');
      }
    }
    activate(index) {
      const tabs = this.querySelectorAll(':scope > tab');
      const btns = this.querySelectorAll(':scope > .tab-bar > .tab-btn');
      tabs.forEach((t, i) => i === index ? t.setAttribute('active', '') : t.removeAttribute('active'));
      btns.forEach((b, i) => i === index ? b.classList.add('active') : b.classList.remove('active'));
    }
  }
  customElements.define('tabs', HeydTabs);

  class HeydTab extends HTMLElement {}
  customElements.define('tab', HeydTab);

  // More categories appended in Tasks 3-6...
})();
```

Note: `<section>` and `<nav>` are native HTML elements that cannot be replaced via `customElements.define` for the unprefixed name. We decorate them via MutationObserver. Other components (`card`, `tabs`, `tab`) use custom tag names which can be registered normally.

- [ ] **Step 2: Verify file**

Run: `node --check resources/visualization/components.js` — expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/components.js
git commit -m "feat(visualization): add layout components (section, card, nav, tabs)" -m "Four Web Components for page layout. Native <section> and <nav> decorated via MutationObserver; <card>, <tabs>, <tab> registered as custom elements." -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 2)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 3: Append content components (6) to `components.js`

**Files:**
- Modify: `resources/visualization/components.js` (append before the closing `})()`)

- [ ] **Step 1: Append content components**

Before the closing `})();` in `components.js`, append:

```javascript
  // ================== CONTENT ==================

  // <field> — label + placeholder textarea mock
  class HeydField extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const placeholder = this.getAttribute('placeholder') || label || 'Enter value...';
      if (label) {
        const l = document.createElement('div');
        l.className = 'field-label';
        l.textContent = label;
        this.prepend(l);
      }
      if (!this.textContent.trim()) {
        const text = document.createTextNode(placeholder);
        this.appendChild(text);
      }
    }
  }
  customElements.define('field', HeydField);

  // <stat> — label + value
  class HeydStat extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const value = this.getAttribute('value');
      const delta = this.getAttribute('delta');
      if (label) {
        const l = document.createElement('div');
        l.className = 'stat-label';
        l.textContent = label;
        this.appendChild(l);
      }
      if (value) {
        const v = document.createElement('div');
        v.className = 'stat-value';
        v.textContent = value;
        this.appendChild(v);
      }
      if (delta) {
        const d = document.createElement('div');
        d.className = 'stat-delta' + (delta.startsWith('-') ? ' negative' : ' positive');
        d.textContent = delta;
        this.appendChild(d);
      }
    }
  }
  customElements.define('stat', HeydStat);

  // <tag> — no JS decoration needed; CSS handles display based on variant attr
  class HeydTag extends HTMLElement {}
  customElements.define('tag', HeydTag);

  // <callout> — optional label prefix
  class HeydCallout extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      if (label && !this.querySelector(':scope > .callout-label')) {
        const l = document.createElement('strong');
        l.className = 'callout-label';
        l.textContent = label + ':';
        this.prepend(l, ' ');
      }
    }
  }
  customElements.define('callout', HeydCallout);

  // <ref> — uppercase label badge + optional source link
  class HeydRef extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const source = this.getAttribute('source');
      if (label) {
        const b = document.createElement('span');
        b.className = 'ref-label';
        b.textContent = label;
        this.prepend(b);
      }
      if (source) {
        const p = document.createElement('p');
        p.className = 'ref-source';
        p.innerHTML = `<em>Source: <a href="${source}">${source}</a></em>`;
        // Insert right after label (if any), else at top
        const insertAt = label ? this.children[1] : this.firstChild;
        this.insertBefore(p, insertAt || null);
      }
    }
  }
  customElements.define('ref', HeydRef);

  // <prompt> — accent-border row with optional "Q1"-style label + question
  class HeydPrompt extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const question = this.getAttribute('question');
      if (label || question) {
        const header = document.createElement('p');
        header.className = 'prompt-header';
        header.innerHTML = (label ? `<span class="prompt-label">${label}.</span> ` : '') + (question || '');
        this.prepend(header);
      }
    }
  }
  customElements.define('prompt', HeydPrompt);
```

Also append CSS for the new components to `theme.css` (field-label, stat-value/label/delta, callout-label, ref-label, ref-source, prompt-header, prompt-label). Include these in the same commit; refer to the spec's component catalog for styling cues (match ZaPASS visual language).

- [ ] **Step 2: Verify**

Run: `node --check resources/visualization/components.js`
Run: `grep -c "customElements.define" resources/visualization/components.js` — expected: 9 (Task 2 registered 3: `card`, `tabs`, `tab`; Task 3 adds 6: `field`, `stat`, `tag`, `callout`, `ref`, `prompt`). `section` and `nav` are decorated via MutationObserver, not registered.

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/components.js resources/visualization/theme.css
git commit -m "feat(visualization): add content components (field, stat, tag, callout, ref, prompt)" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 3)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 4: Append flow components (4) to `components.js`

**Files:**
- Modify: `resources/visualization/components.js` (append)
- Modify: `resources/visualization/theme.css` (append styles)

- [ ] **Step 1: Append flow components**

Append to `components.js`:

```javascript
  // ================== FLOW ==================

  // <steps> — numbered list of <step> children
  class HeydSteps extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const steps = this.querySelectorAll(':scope > step');
      steps.forEach((step, i) => {
        if (step.dataset.heydNumbered) return;
        step.dataset.heydNumbered = '1';
        const num = step.getAttribute('num') || (i + 1);
        const circle = document.createElement('span');
        circle.className = 'step-num';
        circle.textContent = num;
        step.prepend(circle);
      });
    }
  }
  customElements.define('steps', HeydSteps);

  class HeydStep extends HTMLElement {}
  customElements.define('step', HeydStep);

  // <flow> — multi-column with → arrows between flow-items
  class HeydFlow extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const items = Array.from(this.querySelectorAll(':scope > flow-item'));
      const cols = items.length;
      // Create grid: items separated by → arrows
      // grid-template-columns: repeat(cols, 1fr) with 20px arrows between
      const colDef = items.map((_, i) => i < cols - 1 ? '1fr 20px' : '1fr').join(' ');
      this.style.gridTemplateColumns = colDef;
      items.forEach((item, i) => {
        if (i < cols - 1) {
          const arrow = document.createElement('div');
          arrow.className = 'flow-arrow';
          arrow.textContent = '→';
          item.insertAdjacentElement('afterend', arrow);
        }
        // Decorate with label if attr present
        const label = item.getAttribute('label');
        if (label && !item.dataset.heydLabeled) {
          item.dataset.heydLabeled = '1';
          const l = document.createElement('div');
          l.className = 'flow-item-label';
          l.textContent = label;
          item.prepend(l);
        }
      });
    }
  }
  customElements.define('flow', HeydFlow);

  class HeydFlowItem extends HTMLElement {}
  customElements.define('flow-item', HeydFlowItem);

  // <compare> — two-column via named slots a + b
  class HeydCompare extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const labelA = this.getAttribute('label-a');
      const labelB = this.getAttribute('label-b');
      const slotA = this.querySelector('[slot="a"]');
      const slotB = this.querySelector('[slot="b"]');
      const colA = document.createElement('div');
      colA.className = 'compare-col compare-a';
      if (labelA) colA.innerHTML = `<h4 class="compare-label">${labelA}</h4>`;
      if (slotA) colA.appendChild(slotA);
      const colB = document.createElement('div');
      colB.className = 'compare-col compare-b';
      if (labelB) colB.innerHTML = `<h4 class="compare-label">${labelB}</h4>`;
      if (slotB) colB.appendChild(slotB);
      this.innerHTML = '';
      this.appendChild(colA);
      this.appendChild(colB);
    }
  }
  customElements.define('compare', HeydCompare);

  // <matrix> — 2x2 quadrant with axis labels
  class HeydMatrix extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const axisTop = (this.getAttribute('axis-top') || '').split('|');
      const axisLeft = (this.getAttribute('axis-left') || '').split('|');
      const slots = ['q1', 'q2', 'q3', 'q4'].map(n => this.querySelector(`[slot="${n}"]`));
      // Build: 3-col grid (80px | 1fr | 1fr) × 3-row grid (40px | 1fr | 1fr)
      this.innerHTML = '';
      if (axisTop[0]) {
        const a = document.createElement('div');
        a.className = 'matrix-axis matrix-axis-top-left';
        a.textContent = axisTop[0];
        this.appendChild(a);
      }
      if (axisTop[1]) {
        const a = document.createElement('div');
        a.className = 'matrix-axis matrix-axis-top-right';
        a.textContent = axisTop[1];
        this.appendChild(a);
      }
      if (axisLeft[0]) {
        const a = document.createElement('div');
        a.className = 'matrix-axis matrix-axis-left-top';
        a.textContent = axisLeft[0];
        this.appendChild(a);
      }
      if (axisLeft[1]) {
        const a = document.createElement('div');
        a.className = 'matrix-axis matrix-axis-left-bottom';
        a.textContent = axisLeft[1];
        this.appendChild(a);
      }
      // Cells in order: q3 (top-left), q1 (top-right), q4 (bot-left), q2 (bot-right)
      ['q3', 'q1', 'q4', 'q2'].forEach(name => {
        const el = this.querySelector(`[slot="${name}"]`);
        if (el) {
          const cell = document.createElement('div');
          cell.className = `matrix-cell matrix-${name}`;
          cell.appendChild(el);
          this.appendChild(cell);
        }
      });
    }
  }
  customElements.define('matrix', HeydMatrix);
```

Append matching CSS to `theme.css` (step-num, flow-arrow, flow-item-label, compare-col/label, matrix-axis/cell variants).

- [ ] **Step 2: Verify**

Run: `node --check resources/visualization/components.js`
Run: `grep -c "customElements.define" resources/visualization/components.js` — expected: 15 (9 + 6 new: `steps`, `step`, `flow`, `flow-item`, `compare`, `matrix`).

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/components.js resources/visualization/theme.css
git commit -m "feat(visualization): add flow components (steps, flow, compare, matrix)" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 4)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 5: Append decision components (2) + document components (2)

**Files:**
- Modify: `resources/visualization/components.js`
- Modify: `resources/visualization/theme.css`

- [ ] **Step 1: Append decision + document components**

Append to `components.js`:

```javascript
  // ================== DECISION ==================

  // <approach> — title + optional selected marker
  class HeydApproach extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const title = this.getAttribute('title');
      if (title) {
        const h = document.createElement('h4');
        h.className = 'approach-title';
        h.textContent = title;
        if (this.hasAttribute('selected')) {
          const check = document.createElement('span');
          check.className = 'approach-selected';
          check.textContent = ' ✓ selected';
          h.appendChild(check);
        }
        this.prepend(h);
      }
    }
  }
  customElements.define('approach', HeydApproach);

  // <tradeoff> — pros/cons via named slots
  class HeydTradeoff extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const pros = this.querySelector('[slot="pros"]');
      const cons = this.querySelector('[slot="cons"]');
      this.innerHTML = '';
      if (pros) {
        const wrap = document.createElement('div');
        wrap.className = 'tradeoff-pros';
        wrap.innerHTML = '<h5>Pros</h5>';
        wrap.appendChild(pros);
        this.appendChild(wrap);
      }
      if (cons) {
        const wrap = document.createElement('div');
        wrap.className = 'tradeoff-cons';
        wrap.innerHTML = '<h5>Cons</h5>';
        wrap.appendChild(cons);
        this.appendChild(wrap);
      }
    }
  }
  customElements.define('tradeoff', HeydTradeoff);

  // ================== DOCUMENT ==================

  // <toc> — auto-generate from <section> headings, or use manual content
  class HeydToc extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      if (this.hasAttribute('auto') && !this.hasChildNodes()) {
        // Wait for body to be parsed (defer to next microtask)
        queueMicrotask(() => {
          const sections = document.querySelectorAll('section[title]');
          const ol = document.createElement('ol');
          sections.forEach(s => {
            const id = s.id || s.getAttribute('title').toLowerCase().replace(/\s+/g, '-');
            s.id = id;
            const li = document.createElement('li');
            li.innerHTML = `<a href="#${id}">${s.getAttribute('title')}</a>`;
            ol.appendChild(li);
          });
          const h = document.createElement('h2');
          h.className = 'toc-title';
          h.textContent = 'Contents';
          this.appendChild(h);
          this.appendChild(ol);
        });
      }
    }
  }
  customElements.define('toc', HeydToc);

  // <code> — basic syntax display; no highlighting library in v1
  class HeydCode extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      // Preserve existing whitespace by wrapping in <pre> if not already
      if (this.tagName === 'CODE' && this.parentElement?.tagName !== 'PRE') {
        const pre = document.createElement('pre');
        pre.className = 'code';
        const lang = this.getAttribute('language');
        if (lang) pre.setAttribute('data-language', lang);
        this.parentNode.insertBefore(pre, this);
        pre.appendChild(this);
      }
    }
  }
  // <code> is a native element; we enhance the ones that have a language attr.
  // Authors write: <code language="ts">...</code>
  const codeObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && node.tagName === 'CODE' && node.hasAttribute('language')) {
          decorateCode(node);
        }
      }
    }
  });
  function decorateCode(el) {
    if (el.dataset.heydDecorated) return;
    el.dataset.heydDecorated = '1';
    if (el.parentElement?.tagName !== 'PRE') {
      const pre = document.createElement('pre');
      pre.className = 'code';
      pre.setAttribute('data-language', el.getAttribute('language') || '');
      el.parentNode.insertBefore(pre, el);
      pre.appendChild(el);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('code[language]').forEach(decorateCode);
    codeObserver.observe(document.body, { childList: true, subtree: true });
  });
```

- [ ] **Step 2: Verify**

Run: `node --check resources/visualization/components.js`
Run: `grep -c "customElements.define" resources/visualization/components.js` — expected: 18 (or close — approach, tradeoff, toc = 3 new registrations; `code` handled via decorator like section/nav).

Final count after Task 5: 17 registered custom elements (`card`, `tabs`, `tab`, `field`, `stat`, `tag`, `callout`, `ref`, `prompt`, `steps`, `step`, `flow`, `flow-item`, `compare`, `matrix`, `approach`, `tradeoff`, `toc` — actually 18). Plus `section`, `nav`, `code` decorated via MutationObserver (3 native-element decorators).

Maps to the 18 catalog components: each component pair (e.g., `tabs`/`tab`) is one catalog entry. 18 catalog components = 18 registered + 3 native-decorated behaviors overall.

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/components.js resources/visualization/theme.css
git commit -m "feat(visualization): add decision + document components (approach, tradeoff, toc, code)" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 5)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 6: Create `examples/gallery.html`

**Files:**
- Create: `resources/visualization/examples/gallery.html`

- [ ] **Step 1: Write a gallery page**

Create a full HTML file that uses every component once, for manual visual testing. Include links to `theme.css` and `components.js` (relative paths). Structure:

```html
<!DOCTYPE html>
<html><head>
  <title>hey-d visualization gallery</title>
  <link rel="stylesheet" href="../theme.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="../components.js"></script>
</head>
<body>
  <main>
    <toc auto></toc>
    <section title="Layout examples" id="layout">
      <card title="A card with title">
        <p>Card body content.</p>
      </card>
      <card tag="BLOCK 1" title="Card with a tag badge">
        <p>Content...</p>
      </card>
      <nav title="My App">
        <a href="#">Home</a> <a href="#">About</a>
      </nav>
      <tabs>
        <tab label="First" active><p>First tab content</p></tab>
        <tab label="Second" badge="new"><p>Second tab content</p></tab>
      </tabs>
    </section>

    <section title="Content examples" id="content">
      <field label="Name" size="sm"></field>
      <field label="Notes" size="lg" placeholder="Multi-line text..."></field>
      <stat label="Users" value="1,234" delta="+5%"></stat>
      <tag>default</tag>
      <tag variant="required">required</tag>
      <tag variant="optional">optional</tag>
      <tag variant="accent">accent</tag>
      <callout variant="info">An info callout with context.</callout>
      <callout variant="translate" label="EN">A translation callout.</callout>
      <callout variant="warning">A warning.</callout>
      <ref label="REFERENCE" source="docs/original.md">
        <h4>Reference content</h4>
        <p>Source material goes here.</p>
      </ref>
      <prompt label="Q1" question="What evidence supports this?">
        <field size="md" placeholder="Answer..."></field>
      </prompt>
    </section>

    <section title="Flow examples" id="flow">
      <steps>
        <step>First step of a process</step>
        <step>Second step</step>
        <step>Third step</step>
      </steps>
      <flow>
        <flow-item label="Step A">First</flow-item>
        <flow-item label="Step B">Second</flow-item>
        <flow-item label="Step C" highlight>Highlighted</flow-item>
      </flow>
      <compare label-a="Option A" label-b="Option B">
        <div slot="a">Option A details</div>
        <div slot="b">Option B details</div>
      </compare>
      <matrix axis-top="Horizontal Left|Horizontal Right" axis-left="Vertical Top|Vertical Bottom">
        <div slot="q1">Q1 (top-right)</div>
        <div slot="q2">Q2 (bottom-right)</div>
        <div slot="q3">Q3 (top-left)</div>
        <div slot="q4">Q4 (bottom-left)</div>
      </matrix>
    </section>

    <section title="Decision examples" id="decision">
      <approach title="Path 1 — simple">
        <p>Description...</p>
        <tradeoff>
          <ul slot="pros"><li>Easy</li></ul>
          <ul slot="cons"><li>Limited</li></ul>
        </tradeoff>
      </approach>
      <approach title="Path 2 — recommended" selected>
        <p>Description...</p>
      </approach>
    </section>

    <section title="Document examples" id="document">
      <code language="ts">const greeting = "Hello, world!";</code>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 2: Verify**

Open `resources/visualization/examples/gallery.html` in a browser. Expected:
- TOC at top lists all sections
- Each component renders with styles
- Tabs are clickable
- Matrix has axis labels at top and left
- Approach #2 shows " ✓ selected" after its title

If anything looks broken, fix the corresponding component or CSS and re-test before committing.

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/examples/gallery.html
git commit -m "feat(visualization): add component gallery for visual testing" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 6)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 7: Build pre-built `tailwind.css`

**Files:**
- Create: `resources/visualization/build-tailwind.sh`
- Create: `resources/visualization/tailwind.css` (build output)

- [ ] **Step 1: Write a build script**

Create `resources/visualization/build-tailwind.sh`:

```bash
#!/usr/bin/env bash
# Rebuild resources/visualization/tailwind.css from components.js + examples/gallery.html
# Uses Tailwind CLI (installed globally or via npx). Pruned to classes actually used.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Create a minimal tailwind.config.js on the fly (or use a stored one)
cat > .tailwind.config.tmp.js <<EOF
module.exports = {
  content: ['./components.js', './examples/**/*.html'],
  theme: { extend: {} },
};
EOF

npx tailwindcss -c .tailwind.config.tmp.js -o tailwind.css --minify

rm .tailwind.config.tmp.js
echo "tailwind.css rebuilt: $(wc -c < tailwind.css) bytes"
```

Make executable: `chmod +x resources/visualization/build-tailwind.sh`

- [ ] **Step 2: Run the build**

```bash
./resources/visualization/build-tailwind.sh
```

Expected: `tailwind.css` produced, 50-100KB. If `npx tailwindcss` is unavailable, install: `npm install -g tailwindcss` or similar.

- [ ] **Step 3: Commit**

```bash
git add resources/visualization/build-tailwind.sh resources/visualization/tailwind.css
git commit -m "feat(visualization): add build-tailwind.sh and pre-built tailwind.css" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 7)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 8: Create `wrapper.html` template

**Files:**
- Create: `resources/visualization/wrapper.html`

- [ ] **Step 1: Write wrapper template**

Create with placeholders. Uses CDN for dev-server use; snapshot tool will substitute inline.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{title}}</title>

  <!-- Tailwind: CDN in dev, inline in snapshot -->
  {{tailwind_block}}

  <!-- hey-d theme (plugin + project override) -->
  {{theme_block}}

  <!-- Components (plugin + project override) -->
  {{components_block}}
</head>
<body>
  <main>
    {{content}}
  </main>
</body>
</html>
```

The `{{*_block}}` placeholders are replaced by the server/snapshot tool with either `<link rel="stylesheet" href="...">` / `<script src="...">` tags or inline `<style>` / `<script>` content.

- [ ] **Step 2: Commit**

```bash
git add resources/visualization/wrapper.html
git commit -m "feat(visualization): add wrapper.html template" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 8)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 9: Create `snapshot.js` (Node.js tool)

**Files:**
- Create: `resources/visualization/snapshot.js`
- Create: `resources/visualization/snapshot.sh`

- [ ] **Step 1: Write snapshot.js**

Reads a fragment file, inlines all resources, produces self-contained HTML.

```javascript
#!/usr/bin/env node
/**
 * snapshot.js — convert a hey-d visualization fragment into a standalone HTML file.
 *
 * Usage:
 *   node snapshot.js <fragment.html> [--out <output.html>] [--title "Spec Doc"]
 */

const fs = require('fs');
const path = require('path');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: snapshot.js <fragment.html> [--out <output>] [--title <title>]');
    process.exit(1);
  }

  const input = args[0];
  const outIdx = args.indexOf('--out');
  const output = outIdx >= 0 ? args[outIdx + 1] : input.replace(/\.html$/, '.snapshot.html');
  const titleIdx = args.indexOf('--title');
  const title = titleIdx >= 0 ? args[titleIdx + 1] : path.basename(input, '.html');

  const here = __dirname; // resources/visualization/
  const fragment = fs.readFileSync(input, 'utf-8');

  // Load resources
  const themeCss = fs.readFileSync(path.join(here, 'theme.css'), 'utf-8');
  const tailwindCss = fs.readFileSync(path.join(here, 'tailwind.css'), 'utf-8');
  const componentsJs = fs.readFileSync(path.join(here, 'components.js'), 'utf-8');

  // Optional: project override at <cwd>/.agents/config/visualization/
  const projectRoot = process.cwd();
  const projectThemeCss = readIfExists(path.join(projectRoot, '.agents/config/visualization/theme.css'));
  const projectComponentsJs = readIfExists(path.join(projectRoot, '.agents/config/visualization/components.js'));

  // Extract just the <main> content if fragment is wrapped, else use as-is
  const mainMatch = fragment.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const content = mainMatch ? mainMatch[1] : fragment;

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${tailwindCss}</style>
  <style>${themeCss}</style>
  ${projectThemeCss ? `<style>${projectThemeCss}</style>` : ''}
  <script>${componentsJs}</script>
  ${projectComponentsJs ? `<script>${projectComponentsJs}</script>` : ''}
</head>
<body>
  <main>
    ${content}
  </main>
</body>
</html>`;

  fs.writeFileSync(output, html);
  console.log(`Wrote ${output} (${(html.length / 1024).toFixed(1)} KB)`);
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

function escapeHtml(s) {
  return s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

main();
```

- [ ] **Step 2: Write snapshot.sh wrapper**

```bash
#!/usr/bin/env bash
# Thin wrapper around snapshot.js for convenience.
exec node "$(dirname "$0")/snapshot.js" "$@"
```

Make both executable: `chmod +x resources/visualization/snapshot.js resources/visualization/snapshot.sh`

- [ ] **Step 3: Smoke test**

```bash
./resources/visualization/snapshot.sh resources/visualization/examples/gallery.html --out /tmp/snapshot-test.html
ls -lh /tmp/snapshot-test.html
```

Expected: a file of 150-300KB is produced. Open in a browser — gallery renders identically to the non-snapshot version.

- [ ] **Step 4: Commit**

```bash
git add resources/visualization/snapshot.js resources/visualization/snapshot.sh
git commit -m "feat(visualization): add snapshot.js tool for standalone HTML generation" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 9)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 10: Extend brainstorm-server with new routes

**Files:**
- Modify: `tests/brainstorm-server/server.js`

- [ ] **Step 1: Read the current server.js**

```bash
cat tests/brainstorm-server/server.js | head -80
```

Identify where HTTP routes are handled (look for `createServer` and the request handler). Existing routes: `/` serves newest HTML, `/files/*` serves static files, everything else 404.

- [ ] **Step 2: Add two new route groups**

Before the 404 fall-through, add:

```javascript
// hey-d visualization plugin resources
if (req.url.startsWith('/resources/visualization/')) {
  const relPath = req.url.replace('/resources/visualization/', '');
  const filePath = path.join(PLUGIN_ROOT, 'resources/visualization', relPath);
  return serveFile(filePath, res);
}

// Optional project overrides
if (req.url.startsWith('/.agents/config/visualization/')) {
  const relPath = req.url.replace('/.agents/config/visualization/', '');
  const filePath = path.join(PROJECT_ROOT, '.agents/config/visualization', relPath);
  return serveFile(filePath, res); // serveFile returns 404 if not found
}
```

Where `PLUGIN_ROOT` comes from the existing plugin-root detection and `PROJECT_ROOT` is the directory containing `.agents/config/` (typically the working directory passed to the server).

- [ ] **Step 3: Replace the wrapper template**

Update the fragment-wrapping logic to use the new `wrapper.html` template. The existing `frame-template.html` is renamed/replaced. Fragment injection still uses the `{{content}}` placeholder (or add one if missing).

- [ ] **Step 4: Commit**

```bash
git add tests/brainstorm-server/server.js tests/brainstorm-server/frame-template.html
git commit -m "feat(brainstorm-server): serve visualization resources and use new wrapper" -m "Adds /resources/visualization/ and /.agents/config/visualization/ routes; replaces frame-template.html with wrapper.html." -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 10)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 11: Write route tests

**Files:**
- Create: `tests/brainstorm-server/visualization-routes.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// Assumes brainstorm-server is started on a known port via test setup
// (use the existing pattern from server.test.js)

describe('visualization resource routes', () => {
  it('serves plugin components.js', async () => {
    const res = await fetch(`${BASE_URL}/resources/visualization/components.js`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /customElements\.define/);
  });

  it('serves plugin theme.css', async () => {
    const res = await fetch(`${BASE_URL}/resources/visualization/theme.css`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /--accent/);
  });

  it('returns 404 for missing project override', async () => {
    const res = await fetch(`${BASE_URL}/.agents/config/visualization/nonexistent.js`);
    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd tests/brainstorm-server && node --test visualization-routes.test.js
```

Expected: test fails (routes not yet serving OR server not configured for test yet). If routes from Task 10 are in place and server is started correctly, tests should pass.

- [ ] **Step 3: Make tests pass**

Fix any missing setup (server start/stop hooks, PLUGIN_ROOT path). Re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/brainstorm-server/visualization-routes.test.js
git commit -m "test(brainstorm-server): add route tests for visualization resources" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 11)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

### Task 12: Write snapshot test

**Files:**
- Create: `tests/brainstorm-server/snapshot.test.js`

- [ ] **Step 1: Write snapshot smoke test**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

describe('snapshot.js', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heyd-snapshot-'));
  const fragmentPath = path.join(tmpDir, 'fragment.html');
  const outputPath = path.join(tmpDir, 'out.html');

  it('produces a self-contained HTML file', () => {
    fs.writeFileSync(fragmentPath, '<card title="Test"><p>Hello</p></card>');
    execSync(`node resources/visualization/snapshot.js ${fragmentPath} --out ${outputPath}`);
    assert.ok(fs.existsSync(outputPath));
    const out = fs.readFileSync(outputPath, 'utf-8');
    assert.match(out, /<!DOCTYPE html>/);
    assert.match(out, /<style>.*--accent/s);           // theme.css inlined
    assert.match(out, /<style>.*tailwindcss/s);         // tailwind.css inlined
    assert.match(out, /<script>.*customElements\.define/s); // components.js inlined
    assert.match(out, /<main>[\s\S]*<card title="Test"/);   // content in <main>
  });
});
```

- [ ] **Step 2: Run**

```bash
node --test tests/brainstorm-server/snapshot.test.js
```

Expected: passes. If not, fix snapshot.js and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/brainstorm-server/snapshot.test.js
git commit -m "test(brainstorm-server): add snapshot smoke test" -m "Plan: docs/plans/2026-04-17-visualization-library.md (Task 12)" -m "Co-authored-by: Claude Opus 4.6 <ai@botfi.dev>"
```

---

## Release

After all tasks complete and verified, do NOT release yet. Plan 2 (skill integration) will ship as a bundle with Plan 1. Release them together as `5.0.7-d.5`.

---

## Notes for the Implementer

- **This is markdown + JS + CSS work.** TDD cycle applies strictly to snapshot.js and the route tests. Component rendering is validated via the gallery (manual visual check), not automated — that's acknowledged out-of-scope in the spec's testing section.
- **Order matters.** Tasks 1–6 build up `components.js` and `theme.css` incrementally. Don't try to parallelize — the file grows.
- **Gallery is your reliability net.** After each component category is added (Tasks 2–5), open the gallery and verify the newly-added components render. Catch CSS bugs early.
- **If a component's behavior is subtle** (e.g., `<matrix>` with slot ordering), explore by tweaking the gallery and iterating. The component catalog in the spec is the source of truth.
- **Do NOT touch skill integration.** Plan 2 handles visualization-components.md, the visual-companion update, and the hey-d:visualize skill. Stay in your lane.
