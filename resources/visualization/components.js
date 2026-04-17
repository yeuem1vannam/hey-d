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

  // <section> is a native HTML5 element — decorate via MutationObserver.
  // Authors write: <section title="..." subtitle="...">...</section>
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

  // <nav> is also native — same pattern.
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

  // <card> — custom element with optional tag badge + title
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

  // Decorate native elements on DOM ready and as new nodes are added
  const nativeObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'SECTION' && node.hasAttribute('title')) decorateSection(node);
        if (node.tagName === 'NAV' && node.hasAttribute('title')) decorateNav(node);
      }
    }
  });

  function init() {
    document.querySelectorAll('section[title]').forEach(decorateSection);
    document.querySelectorAll('nav[title]').forEach(decorateNav);
    nativeObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

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
        this.appendChild(document.createTextNode(placeholder));
      }
    }
  }
  customElements.define('field', HeydField);

  // <stat> — KPI / metric display
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

  // <tag> — styling via CSS only
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
        l.textContent = label + ': ';
        this.prepend(l);
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
        const insertAt = label ? this.children[1] : this.firstChild;
        this.insertBefore(p, insertAt || null);
      }
    }
  }
  customElements.define('ref', HeydRef);

  // <prompt> — accent-border row with optional label + question
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

  // ================== FLOW ==================

  // <steps> — numbered <step> children
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
      const colDef = items.map((_, i) => i < cols - 1 ? '1fr 20px' : '1fr').join(' ');
      this.style.gridTemplateColumns = colDef;
      items.forEach((item, i) => {
        if (i < cols - 1) {
          const arrow = document.createElement('div');
          arrow.className = 'flow-arrow';
          arrow.textContent = '→';
          item.insertAdjacentElement('afterend', arrow);
        }
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

  // <compare> — two-column via named slots
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

  // <matrix> — 2×2 quadrant with axis labels
  class HeydMatrix extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const axisTop = (this.getAttribute('axis-top') || '').split('|');
      const axisLeft = (this.getAttribute('axis-left') || '').split('|');
      const quadrants = { q1: null, q2: null, q3: null, q4: null };
      for (const k of Object.keys(quadrants)) {
        quadrants[k] = this.querySelector(`[slot="${k}"]`);
      }
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
      ['q3', 'q1', 'q4', 'q2'].forEach(name => {
        const el = quadrants[name];
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

  // <toc> — auto-generated from <section title> OR manual content
  class HeydToc extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      if (this.hasAttribute('auto') && !this.hasChildNodes()) {
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

  // <code language="..."> — native element decorated to wrap in <pre>
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
  const codeObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && node.tagName === 'CODE' && node.hasAttribute('language')) {
          decorateCode(node);
        }
      }
    }
  });
  function initCode() {
    document.querySelectorAll('code[language]').forEach(decorateCode);
    codeObserver.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCode);
  } else {
    initCode();
  }

})();
